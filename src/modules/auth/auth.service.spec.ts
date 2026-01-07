import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@modules/users/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PasswordReset } from './entities/password_resets.entity';
import { Repository } from 'typeorm';
import {
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BanStatus } from '@modules/users/enums/ban-status.enum';
import { UserRole } from '@common/enums/user-role.enum';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let mailerService: MailerService;
  let passwordResetRepo: Repository<PasswordReset>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    role: UserRole.STUDENT,
    banStatus: BanStatus.NONE,
  };

  const mockPasswordReset = {
    id: 'reset-123',
    userId: 'user-123',
    email: 'test@example.com',
    purpose: 'reset',
    otpHash: 'hashedOTP',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    lastOtpSentAt: new Date(),
    tokenHash: null,
    tokenExpiresAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            changePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PasswordReset),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    mailerService = module.get<MailerService>(MailerService);
    passwordResetRepo = module.get<Repository<PasswordReset>>(getRepositoryToken(PasswordReset));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestRegisterOtp', () => {
    it('should send OTP for new email registration', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordResetRepo, 'create').mockReturnValue(mockPasswordReset as any);
      jest.spyOn(passwordResetRepo, 'save').mockResolvedValue(mockPasswordReset as any);
      jest.spyOn(mailerService, 'sendMail').mockResolvedValue(null);

      const result = await service.requestRegisterOtp('newuser@example.com');

      expect(result).toEqual({ message: 'An OTP has been sent to your email.' });
      expect(mailerService.sendMail).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already registered', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);

      await expect(service.requestRegisterOtp('test@example.com')).rejects.toThrow(
        BadRequestException
      );
    });


  });

  describe('registerComplete', () => {
    it('should register user with valid token', async () => {
      const validToken = 'validToken123';
      const hashedToken = await bcrypt.hash(validToken, 10);
      const passwordReset = {
        ...mockPasswordReset,
        tokenHash: hashedToken,
        tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(passwordReset as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(true);
      jest.spyOn(usersService, 'create').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'delete').mockResolvedValue({ affected: 1, raw: [] } as any);

      const result = await service.registerComplete(
        'New User',
        'newuser@example.com',
        'password123',
        validToken
      );

      expect(result.message).toBe('Registered successfully');
      expect(result.user).toHaveProperty('id');
    });

    it('should throw BadRequestException if email already exists', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);

      await expect(
        service.registerComplete('User', 'test@example.com', 'pass', 'token')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for expired token', async () => {
      const expiredReset = {
        ...mockPasswordReset,
        tokenHash: 'hash',
        tokenExpiresAt: new Date(Date.now() - 1000),
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(expiredReset as any);

      await expect(
        service.registerComplete('User', 'test@example.com', 'pass', 'token')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = { ...mockUser, password: hashedPassword };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(user as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(true);
      jest.spyOn(jwtService, 'sign').mockReturnValue('jwt-token-123');

      const result = await service.login('test@example.com', 'password123');

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('jwt-token-123');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(service.login('wrong@example.com', 'password')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException for banned user', async () => {
      const bannedUser = { ...mockUser, banStatus: BanStatus.BANNED };
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(bannedUser as any);

      await expect(service.login('test@example.com', 'password')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(false);

      await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('forgot', () => {
    it('should send OTP for password reset', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(passwordResetRepo, 'create').mockReturnValue(mockPasswordReset as any);
      jest.spyOn(passwordResetRepo, 'save').mockResolvedValue(mockPasswordReset as any);
      jest.spyOn(mailerService, 'sendMail').mockResolvedValue(null);

      const result = await service.forgot('test@example.com');

      expect(result).toEqual({ message: 'An OTP has been sent to your email.' });
      expect(mailerService.sendMail).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(service.forgot('nonexistent@example.com')).rejects.toThrow(NotFoundException);
    });

    it('should enforce cooldown between OTP requests', async () => {
      const recentReset = {
        ...mockPasswordReset,
        lastOtpSentAt: new Date(),
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(recentReset as any);

      await expect(service.forgot('test@example.com')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyOtp', () => {
    it('should verify valid OTP and return token', async () => {
      const otp = '1234';
      const hashedOtp = await bcrypt.hash(otp, 10);
      const resetRecord = {
        ...mockPasswordReset,
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(resetRecord as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(true);
      jest.spyOn(passwordResetRepo, 'save').mockResolvedValue(resetRecord as any);

      const result = await service.verifyOtp('test@example.com', otp);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresInMinutes');
    });

    it('should throw BadRequestException if OTP not found', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(null);

      await expect(service.verifyOtp('test@example.com', '1234')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ForbiddenException for expired OTP', async () => {
      const expiredReset = {
        ...mockPasswordReset,
        expiresAt: new Date(Date.now() - 1000),
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(expiredReset as any);

      await expect(service.verifyOtp('test@example.com', '1234')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should increment attempts for invalid OTP', async () => {
      const otp = '1234';
      const resetRecord = {
        ...mockPasswordReset,
        otpHash: 'wrongHash',
        attempts: 0,
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(resetRecord as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(false);
      jest.spyOn(passwordResetRepo, 'save').mockResolvedValue({
        ...resetRecord,
        attempts: 1,
      } as any);

      await expect(service.verifyOtp('test@example.com', otp)).rejects.toThrow(ForbiddenException);
      expect(passwordResetRepo.save).toHaveBeenCalled();
    });

    it('should reject after max attempts', async () => {
      const resetRecord = {
        ...mockPasswordReset,
        attempts: 5,
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'findOne').mockResolvedValue(resetRecord as any);

      await expect(service.verifyOtp('test@example.com', '1234')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('changePassword', () => {
    it('should change password with valid token', async () => {
      const token = 'validResetToken';
      const hashedToken = await bcrypt.hash(token, 10);
      const resetRecord = {
        ...mockPasswordReset,
        tokenHash: hashedToken,
        tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([resetRecord]),
      };

      jest.spyOn(passwordResetRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(true);
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(usersService, 'changePassword').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetRepo, 'delete').mockResolvedValue({ affected: 1, raw: [] } as any);

      const result = await service.changePassword(token, 'newPassword123');

      expect(result.message).toBe('Password has been reset successfully');
      expect(usersService.changePassword).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for invalid token', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(passwordResetRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(service.changePassword('invalidToken', 'newPass')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      const token = 'validToken';
      const hashedToken = await bcrypt.hash(token, 10);
      const resetRecord = {
        ...mockPasswordReset,
        tokenHash: hashedToken,
        tokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([resetRecord]),
      };

      jest.spyOn(passwordResetRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(true);
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(service.changePassword(token, 'newPass')).rejects.toThrow(NotFoundException);
    });
  });
});
