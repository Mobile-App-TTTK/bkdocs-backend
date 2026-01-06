import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    requestRegisterOtp: jest.fn(),
    verifyOtp: jest.fn(),
    registerComplete: jest.fn(),
    login: jest.fn(),
    forgot: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestRegisterOtp', () => {
    it('should request OTP for registration', async () => {
      const dto = { email: 'test@example.com' };
      mockAuthService.requestRegisterOtp.mockResolvedValue({ message: 'OTP sent' });

      const result = await controller.requestRegisterOtp(dto);

      expect(authService.requestRegisterOtp).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual({ message: 'OTP sent' });
    });

    it('should handle different emails', async () => {
      const dto = { email: 'another@test.com' };
      mockAuthService.requestRegisterOtp.mockResolvedValue({ message: 'OTP sent' });

      await controller.requestRegisterOtp(dto);

      expect(authService.requestRegisterOtp).toHaveBeenCalledWith('another@test.com');
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP', async () => {
      const dto = { email: 'test@example.com', otp: '123456' };
      const mockToken = { token: 'verify-token' };
      mockAuthService.verifyOtp.mockResolvedValue(mockToken);

      const result = await controller.verifyOtp(dto);

      expect(authService.verifyOtp).toHaveBeenCalledWith('test@example.com', '123456');
      expect(result).toEqual(mockToken);
    });

    it('should verify different OTP codes', async () => {
      const dto = { email: 'test@example.com', otp: '654321' };
      mockAuthService.verifyOtp.mockResolvedValue({ token: 'token' });

      await controller.verifyOtp(dto);

      expect(authService.verifyOtp).toHaveBeenCalledWith('test@example.com', '654321');
    });
  });

  describe('registerComplete', () => {
    it('should complete registration', async () => {
      const dto = {
        name: 'John Doe',
        email: 'test@example.com',
        password: 'password123',
        token: 'verify-token',
      };
      const mockResult = {
        access_token: 'jwt-token',
        user: { id: '1', name: 'John Doe' },
      };
      mockAuthService.registerComplete.mockResolvedValue(mockResult);

      const result = await controller.registerComplete(dto);

      expect(authService.registerComplete).toHaveBeenCalledWith(
        'John Doe',
        'test@example.com',
        'password123',
        'verify-token'
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle registration with different data', async () => {
      const dto = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'secret',
        token: 'token123',
      };
      mockAuthService.registerComplete.mockResolvedValue({});

      await controller.registerComplete(dto);

      expect(authService.registerComplete).toHaveBeenCalledWith(
        'Jane Smith',
        'jane@example.com',
        'secret',
        'token123'
      );
    });
  });

  describe('login', () => {
    it('should login user', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const mockResult = {
        access_token: 'jwt-token',
        user: { id: '1', email: 'test@example.com' },
      };
      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toEqual(mockResult);
    });

    it('should handle login errors', async () => {
      const dto = { email: 'test@example.com', password: 'wrong' };
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(controller.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should login different users', async () => {
      const dto = { email: 'user2@example.com', password: 'pass' };
      mockAuthService.login.mockResolvedValue({ access_token: 'token2' });

      await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith('user2@example.com', 'pass');
    });
  });

  describe('forgot', () => {
    it('should send forgot password email', async () => {
      const dto = { email: 'test@example.com' };
      mockAuthService.forgot.mockResolvedValue({ message: 'Reset email sent' });

      const result = await controller.forgot(dto);

      expect(authService.forgot).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual({ message: 'Reset email sent' });
    });

    it('should handle forgot password for different emails', async () => {
      const dto = { email: 'another@example.com' };
      mockAuthService.forgot.mockResolvedValue({ message: 'Email sent' });

      await controller.forgot(dto);

      expect(authService.forgot).toHaveBeenCalledWith('another@example.com');
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      const dto = { token: 'reset-token', newPassword: 'newpassword123' };
      mockAuthService.changePassword.mockResolvedValue({ message: 'Password changed' });

      const result = await controller.changePassword(dto);

      expect(authService.changePassword).toHaveBeenCalledWith('reset-token', 'newpassword123');
      expect(result).toEqual({ message: 'Password changed' });
    });

    it('should handle different reset tokens', async () => {
      const dto = { token: 'token456', newPassword: 'secret123' };
      mockAuthService.changePassword.mockResolvedValue({});

      await controller.changePassword(dto);

      expect(authService.changePassword).toHaveBeenCalledWith('token456', 'secret123');
    });

    it('should handle change password errors', async () => {
      const dto = { token: 'invalid', newPassword: 'pass' };
      mockAuthService.changePassword.mockRejectedValue(new Error('Invalid token'));

      await expect(controller.changePassword(dto)).rejects.toThrow('Invalid token');
    });
  });
});
