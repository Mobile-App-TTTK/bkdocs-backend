import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseService } from './firebase.service';
import * as admin from 'firebase-admin';

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  app: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  messaging: jest.fn(),
}));

describe('FirebaseService', () => {
  let service: FirebaseService;
  let mockMessaging: any;

  beforeEach(async () => {
    mockMessaging = {
      send: jest.fn(),
      sendEachForMulticast: jest.fn(),
    };

    (admin.messaging as jest.Mock).mockReturnValue(mockMessaging);
    (admin.credential.cert as jest.Mock).mockReturnValue({});
    (admin.initializeApp as jest.Mock).mockReturnValue({} as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [FirebaseService],
    }).compile();

    service = module.get<FirebaseService>(FirebaseService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize Firebase Admin SDK', () => {
      process.env.FIREBASE_PROJECT_ID = 'test-project';
      process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
      process.env.FIREBASE_PRIVATE_KEY = 'test-key';

      service.onModuleInit();

      expect(admin.credential.cert).toHaveBeenCalled();
    });

    it('should handle initialization errors', () => {
      (admin.initializeApp as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Init error');
      });

      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('should use existing app if already initialized', () => {
      (admin as any).apps = [{}];
      (admin.app as jest.Mock).mockReturnValue({});

      service.onModuleInit();

      expect(admin.app).toHaveBeenCalled();
    });
  });

  describe('sendToDevice', () => {
    it('should send notification to device', async () => {
      mockMessaging.send.mockResolvedValue('message-id');

      const result = await service.sendToDevice('token', 'Title', 'Body');

      expect(mockMessaging.send).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should send notification with data', async () => {
      mockMessaging.send.mockResolvedValue('message-id');

      await service.sendToDevice('token', 'Title', 'Body', { key: 'value' });

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { key: 'value' },
        })
      );
    });

    it('should return false if token is empty', async () => {
      const result = await service.sendToDevice('', 'Title', 'Body');

      expect(result).toBe(false);
      expect(mockMessaging.send).not.toHaveBeenCalled();
    });

    it('should handle send errors', async () => {
      mockMessaging.send.mockRejectedValue(new Error('Send error'));

      const result = await service.sendToDevice('token', 'Title', 'Body');

      expect(result).toBe(false);
    });

    it('should handle invalid token errors', async () => {
      const error: any = new Error('Invalid token');
      error.code = 'messaging/invalid-registration-token';
      mockMessaging.send.mockRejectedValue(error);

      const result = await service.sendToDevice('invalid-token', 'Title', 'Body');

      expect(result).toBe(false);
    });

    it('should handle unregistered token errors', async () => {
      const error: any = new Error('Token not registered');
      error.code = 'messaging/registration-token-not-registered';
      mockMessaging.send.mockRejectedValue(error);

      const result = await service.sendToDevice('token', 'Title', 'Body');

      expect(result).toBe(false);
    });

    it('should include Android configuration', async () => {
      mockMessaging.send.mockResolvedValue('id');

      await service.sendToDevice('token', 'Title', 'Body');

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({
            priority: 'high',
          }),
        })
      );
    });

    it('should include APNS configuration', async () => {
      mockMessaging.send.mockResolvedValue('id');

      await service.sendToDevice('token', 'Title', 'Body');

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          apns: expect.any(Object),
        })
      );
    });
  });

  describe('sendToMultipleDevices', () => {
    it('should send to multiple devices', async () => {
      const tokens = ['token1', 'token2', 'token3'];
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 3,
        failureCount: 0,
        responses: [],
      });

      await service.sendToMultipleDevices(tokens, 'Title', 'Body');

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens,
        })
      );
    });

    it('should filter out empty tokens', async () => {
      const tokens = ['token1', '', 'token2', '  '];
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [],
      });

      await service.sendToMultipleDevices(tokens, 'Title', 'Body');

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['token1', 'token2'],
        })
      );
    });

    it('should not send if all tokens are invalid', async () => {
      const tokens = ['', '  ', null as any];

      await service.sendToMultipleDevices(tokens, 'Title', 'Body');

      expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
    });

    it('should handle partial failures', async () => {
      const tokens = ['token1', 'token2', 'token3'];
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 1,
        responses: [
          { success: true },
          { success: true },
          { success: false, error: { message: 'Error' } },
        ],
      });

      await service.sendToMultipleDevices(tokens, 'Title', 'Body');

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalled();
    });

    it('should handle send errors', async () => {
      mockMessaging.sendEachForMulticast.mockRejectedValue(new Error('Send error'));

      await expect(
        service.sendToMultipleDevices(['token1'], 'Title', 'Body')
      ).resolves.not.toThrow();
    });

    it('should send with custom data', async () => {
      const tokens = ['token1'];
      const data = { key: 'value', id: '123' };
      mockMessaging.sendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [],
      });

      await service.sendToMultipleDevices(tokens, 'Title', 'Body', data);

      expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          data,
        })
      );
    });
  });
});
