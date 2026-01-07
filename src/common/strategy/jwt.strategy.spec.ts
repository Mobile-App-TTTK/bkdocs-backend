import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '@modules/users/user.service';
import { BanStatus } from '@modules/users/enums/ban-status.enum';
import { UserRole } from '@common/enums/user-role.enum';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.STUDENT,
    banStatus: BanStatus.NONE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user data for valid payload', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);

      const payload = { sub: 'user-123', email: 'test@example.com' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(usersService.findById).toHaveBeenCalledWith('user-123');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      const payload = { sub: 'user-123', email: 'test@example.com' };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow(
        'Tài khoản đã bị ban hoặc không tồn tại'
      );
    });

    it('should throw UnauthorizedException if user is banned', async () => {
      const bannedUser = { ...mockUser, banStatus: BanStatus.BANNED };
      jest.spyOn(usersService, 'findById').mockResolvedValue(bannedUser as any);

      const payload = { sub: 'user-123', email: 'test@example.com' };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(payload)).rejects.toThrow(
        'Tài khoản đã bị ban hoặc không tồn tại'
      );
    });

    it('should accept active user', async () => {
      const activeUser = { ...mockUser, banStatus: BanStatus.NONE };
      jest.spyOn(usersService, 'findById').mockResolvedValue(activeUser as any);

      const payload = { sub: 'user-123', email: 'test@example.com' };
      const result = await strategy.validate(payload);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
    });
  });
});
