import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Logger } from '@nestjs/common';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;

  const mockNotificationsService = {
    markAsRead: jest.fn(),
    getUserNotifications: jest.fn(),
    subscribeFaculty: jest.fn(),
    subscribeSubject: jest.fn(),
    unsubscribeFaculty: jest.fn(),
    unsubscribeSubject: jest.fn(),
    saveFcmToken: jest.fn(),
    testCreateNotifications: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notif-1';
      const mockNotification = { id: notificationId, isRead: true };
      mockNotificationsService.markAsRead.mockResolvedValue(mockNotification);

      const result = await controller.markAsRead(notificationId);

      expect(notificationsService.markAsRead).toHaveBeenCalledWith(notificationId);
      expect(result.isRead).toBe(true);
    });

    it('should handle different notification IDs', async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({});

      await controller.markAsRead('notif-2');

      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-2');
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications with default pagination', async () => {
      const req = { user: { userId: 'user-1' } };
      const mockResult = {
        data: [{ id: '1', message: 'Test' }],
        total: 1,
        page: 1,
        totalPages: 1,
      };
      mockNotificationsService.getUserNotifications.mockResolvedValue(mockResult);

      const result = await controller.getUserNotifications(req);

      expect(notificationsService.getUserNotifications).toHaveBeenCalledWith('user-1', 1, 10);
      expect(result).toEqual(mockResult);
    });

    it('should return notifications with custom pagination', async () => {
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.getUserNotifications.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        totalPages: 1,
      });

      await controller.getUserNotifications(req, 2, 20);

      expect(notificationsService.getUserNotifications).toHaveBeenCalledWith('user-1', 2, 20);
    });

    it('should handle empty notifications', async () => {
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.getUserNotifications.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      const result = await controller.getUserNotifications(req);

      expect(result.data).toEqual([]);
    });
  });

  describe('subscribeFaculty', () => {
    it('should subscribe to faculty', async () => {
      const facultyId = 'faculty-1';
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.subscribeFaculty.mockResolvedValue({
        message: 'Subscribed successfully',
      });

      const result = await controller.subscribeFaculty(facultyId, req);

      expect(notificationsService.subscribeFaculty).toHaveBeenCalledWith('user-1', 'faculty-1');
      expect(result.message).toContain('Subscribed');
    });

    it('should throw error if facultyId is missing', async () => {
      const req = { user: { userId: 'user-1' } };

      await expect(controller.subscribeFaculty('', req)).rejects.toThrow();
    });
  });

  describe('subscribeSubject', () => {
    it('should subscribe to subject', async () => {
      const subjectId = 'subject-1';
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.subscribeSubject.mockResolvedValue({
        message: 'Subscribed successfully',
      });

      const result = await controller.subscribeSubject(subjectId, req);

      expect(notificationsService.subscribeSubject).toHaveBeenCalledWith('user-1', 'subject-1');
      expect(result.message).toContain('Subscribed');
    });

    it('should throw error if subjectId is missing', async () => {
      const req = { user: { userId: 'user-1' } };

      await expect(controller.subscribeSubject('', req)).rejects.toThrow();
    });
  });

  describe('unsubscribeFaculty', () => {
    it('should unsubscribe from faculty', async () => {
      const facultyId = 'faculty-1';
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.unsubscribeFaculty.mockResolvedValue({
        message: 'Unsubscribed successfully',
      });

      const result = await controller.unsubscribeFaculty(facultyId, req);

      expect(notificationsService.unsubscribeFaculty).toHaveBeenCalledWith('user-1', 'faculty-1');
      expect(result.message).toContain('Unsubscribed');
    });
  });

  describe('unsubscribeSubject', () => {
    it('should unsubscribe from subject', async () => {
      const subjectId = 'subject-1';
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.unsubscribeSubject.mockResolvedValue({
        message: 'Unsubscribed successfully',
      });

      const result = await controller.unsubscribeSubject(subjectId, req);

      expect(notificationsService.unsubscribeSubject).toHaveBeenCalledWith('user-1', 'subject-1');
      expect(result.message).toContain('Unsubscribed');
    });
  });

  describe('saveFcmToken', () => {
    it('should save FCM token', async () => {
      const dto = { fcmToken: 'token-123' };
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.saveFcmToken.mockResolvedValue({
        message: 'Token saved',
      });

      const result = await controller.saveFcmToken(req, dto);

      expect(notificationsService.saveFcmToken).toHaveBeenCalledWith('user-1', 'token-123');
      expect(result.message).toContain('Token saved');
    });

    it('should handle different tokens', async () => {
      const dto = { fcmToken: 'token-456' };
      const req = { user: { userId: 'user-2' } };
      mockNotificationsService.saveFcmToken.mockResolvedValue({ message: 'Saved' });

      await controller.saveFcmToken(req, dto);

      expect(notificationsService.saveFcmToken).toHaveBeenCalledWith('user-2', 'token-456');
    });
  });

  describe('testCreateNotifications', () => {
    it('should create test notifications with default count', async () => {
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.testCreateNotifications.mockResolvedValue({
        message: 'Created 20 notifications',
        created: 20,
        fcmSent: 20,
      });

      const result = await controller.testCreateNotifications(req);

      expect(notificationsService.testCreateNotifications).toHaveBeenCalledWith('user-1', 20);
      expect(result.created).toBe(20);
    });

    it('should create test notifications with custom count', async () => {
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.testCreateNotifications.mockResolvedValue({
        message: 'Created 5 notifications',
        created: 5,
        fcmSent: 5,
      });

      const result = await controller.testCreateNotifications(req, 5);

      expect(notificationsService.testCreateNotifications).toHaveBeenCalledWith('user-1', 5);
      expect(result.created).toBe(5);
    });

    it('should handle large notification count', async () => {
      const req = { user: { userId: 'user-1' } };
      mockNotificationsService.testCreateNotifications.mockResolvedValue({
        message: 'Created 100 notifications',
        created: 100,
        fcmSent: 50,
      });

      await controller.testCreateNotifications(req, 100);

      expect(notificationsService.testCreateNotifications).toHaveBeenCalledWith('user-1', 100);
    });
  });
});
