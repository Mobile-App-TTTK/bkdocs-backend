import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { Faculty } from '../documents/entities/faculty.entity';
import { Subject } from '../documents/entities/subject.entity';
import { FirebaseService } from './firebase.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@common/enums/notification-type.enum';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepository: Repository<Notification>;
  let userRepository: Repository<User>;
  let facultyRepository: Repository<Faculty>;
  let subjectRepository: Repository<Subject>;
  let firebaseService: FirebaseService;

  const mockUser = {
    id: '1',
    email: 'user@test.com',
    name: 'Test User',
    fcmToken: 'test-fcm-token',
    subscribedFaculties: [],
    subscribedSubjects: [],
  };

  const mockFaculty = {
    id: '1',
    name: 'Công nghệ phần mềm',
  };

  const mockSubject = {
    id: '1',
    name: 'Lập trình Web',
  };

  const mockNotification = {
    id: '1',
    message: 'Test message',
    user: mockUser,
    type: NotificationType.DOCUMENT,
    targetId: 'doc-1',
    isRead: false,
    createdAt: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
    select: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findByIds: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Faculty),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            findByIds: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: FirebaseService,
          useValue: {
            sendToDevice: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationRepository = module.get<Repository<Notification>>(getRepositoryToken(Notification));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    facultyRepository = module.get<Repository<Faculty>>(getRepositoryToken(Faculty));
    subjectRepository = module.get<Repository<Subject>>(getRepositoryToken(Subject));
    firebaseService = module.get<FirebaseService>(FirebaseService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserNotifications', () => {
    it('should return user notifications with pagination', async () => {
      const notifications = [mockNotification];
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(notificationRepository, 'findAndCount')
        .mockResolvedValue([notifications as any, 1]);

      const result = await service.getUserNotifications('1', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should throw BadRequestException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getUserNotifications('999', 1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should calculate correct pagination', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(notificationRepository, 'findAndCount').mockResolvedValue([[] as any, 25]);

      const result = await service.getUserNotifications('1', 2, 10);

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });

    it('should handle empty notifications', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(notificationRepository, 'findAndCount').mockResolvedValue([[], 0]);

      const result = await service.getUserNotifications('1', 1, 10);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('sendNewDocumentNotification', () => {
    it('should send notifications to subscribed users', async () => {
      const subscribedUsers = [
        { id: '2', fcmToken: 'token1' },
        { id: '3', fcmToken: 'token2' },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(subscribedUsers);
      jest.spyOn(userRepository, 'findByIds').mockResolvedValue(subscribedUsers as any);
      jest.spyOn(facultyRepository, 'findByIds').mockResolvedValue([mockFaculty] as any);
      jest.spyOn(subjectRepository, 'findOne').mockResolvedValue(mockSubject as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(mockNotification as any);
      jest.spyOn(firebaseService, 'sendToDevice').mockResolvedValue(true);

      await service.sendNewDocumentNotification('doc-1', ['1'], '1', 'Test Document', 'uploader-1');

      expect(notificationRepository.save).toHaveBeenCalled();
      expect(firebaseService.sendToDevice).toHaveBeenCalled();
    });

    it('should not send to uploader', async () => {
      const users = [
        { id: 'uploader-1', fcmToken: 'token1' },
        { id: '2', fcmToken: 'token2' },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(users);
      jest.spyOn(userRepository, 'findByIds').mockResolvedValue([users[1]] as any);
      jest.spyOn(facultyRepository, 'findByIds').mockResolvedValue([mockFaculty] as any);
      jest.spyOn(subjectRepository, 'findOne').mockResolvedValue(mockSubject as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(mockNotification as any);
      jest.spyOn(firebaseService, 'sendToDevice').mockResolvedValue(true);

      await service.sendNewDocumentNotification('doc-1', ['1'], '1', 'Test Document', 'uploader-1');

      expect(userRepository.findByIds).toHaveBeenCalledWith(['2']);
    });

    it('should handle no subscribed users', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      jest.spyOn(userRepository, 'findByIds').mockResolvedValue([]);

      await service.sendNewDocumentNotification('doc-1', ['1'], '1', 'Test Document');

      expect(notificationRepository.save).not.toHaveBeenCalled();
    });

    it('should include followers of uploader', async () => {
      const followers = [{ id: '2', fcmToken: 'token1' }];

      mockQueryBuilder.getMany
        .mockResolvedValueOnce([]) // subscribed users
        .mockResolvedValueOnce(followers); // followers

      jest.spyOn(userRepository, 'findByIds').mockResolvedValue(followers as any);
      jest.spyOn(facultyRepository, 'findByIds').mockResolvedValue([mockFaculty] as any);
      jest.spyOn(subjectRepository, 'findOne').mockResolvedValue(mockSubject as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(mockNotification as any);
      jest.spyOn(firebaseService, 'sendToDevice').mockResolvedValue(true);

      await service.sendNewDocumentNotification('doc-1', ['1'], '1', 'Test Document', 'uploader-1');

      expect(notificationRepository.save).toHaveBeenCalled();
    });

    it('should handle users without FCM tokens', async () => {
      const users = [{ id: '2', fcmToken: null }];

      mockQueryBuilder.getMany.mockResolvedValue(users);
      jest.spyOn(userRepository, 'findByIds').mockResolvedValue(users as any);
      jest.spyOn(facultyRepository, 'findByIds').mockResolvedValue([mockFaculty] as any);
      jest.spyOn(subjectRepository, 'findOne').mockResolvedValue(mockSubject as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(mockNotification as any);

      await service.sendNewDocumentNotification('doc-1', ['1'], '1', 'Test Document');

      expect(notificationRepository.save).toHaveBeenCalled();
      expect(firebaseService.sendToDevice).not.toHaveBeenCalled();
    });
  });

  describe('sendDocumentApprovedNotification', () => {
    it('should send approval notification to uploader', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(mockNotification as any);
      jest.spyOn(firebaseService, 'sendToDevice').mockResolvedValue(true);

      await service.sendDocumentApprovedNotification(
        'doc-1',
        '1',
        'Test Document',
        ['Khoa CNTT'],
        'Lập trình Web'
      );

      expect(notificationRepository.save).toHaveBeenCalled();
      expect(firebaseService.sendToDevice).toHaveBeenCalled();
    });

    it('should handle uploader not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await service.sendDocumentApprovedNotification('doc-1', '999', 'Test Document');

      expect(notificationRepository.save).not.toHaveBeenCalled();
    });

    it('should handle uploader without FCM token', async () => {
      const userWithoutToken = { ...mockUser, fcmToken: null };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithoutToken as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(mockNotification as any);

      await service.sendDocumentApprovedNotification('doc-1', '1', 'Test Document');

      expect(notificationRepository.save).toHaveBeenCalled();
      expect(firebaseService.sendToDevice).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      jest.spyOn(notificationRepository, 'findOne').mockResolvedValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue({
        ...mockNotification,
        isRead: true,
      } as any);

      const result = await service.markAsRead('1');

      expect(result.isRead).toBe(true);
      expect(notificationRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if notification not found', async () => {
      jest.spyOn(notificationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.markAsRead('999')).rejects.toThrow(BadRequestException);
    });
  });

  describe('subscribeFaculty', () => {
    it('should subscribe user to faculty', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(facultyRepository, 'findOneBy').mockResolvedValue(mockFaculty as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);

      const result = await service.subscribeFaculty('1', '1');

      expect(result.message).toContain('Đã đăng ký theo dõi khoa');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.subscribeFaculty('999', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if faculty not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(facultyRepository, 'findOneBy').mockResolvedValue(null);

      await expect(service.subscribeFaculty('1', '999')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already subscribed', async () => {
      const userWithFaculty = { ...mockUser, subscribedFaculties: [mockFaculty] };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithFaculty as any);
      jest.spyOn(facultyRepository, 'findOneBy').mockResolvedValue(mockFaculty as any);

      await expect(service.subscribeFaculty('1', '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unsubscribeFaculty', () => {
    it('should unsubscribe user from faculty', async () => {
      const userWithFaculty = { ...mockUser, subscribedFaculties: [mockFaculty] };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithFaculty as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);

      const result = await service.unsubscribeFaculty('1', '1');

      expect(result.message).toContain('Đã hủy theo dõi khoa thành công');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.unsubscribeFaculty('999', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if not subscribed', async () => {
      const userWithoutFaculty = { ...mockUser, subscribedFaculties: [] };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithoutFaculty as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(userWithoutFaculty as any);

      await expect(service.unsubscribeFaculty('1', '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('subscribeSubject', () => {
    it('should subscribe user to subject', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(subjectRepository, 'findOneBy').mockResolvedValue(mockSubject as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);

      const result = await service.subscribeSubject('1', '1');

      expect(result.message).toContain('Đã đăng ký theo dõi môn');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.subscribeSubject('999', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if subject not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(subjectRepository, 'findOneBy').mockResolvedValue(null);

      await expect(service.subscribeSubject('1', '999')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already subscribed', async () => {
      const userWithSubject = { ...mockUser, subscribedSubjects: [mockSubject] };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithSubject as any);
      jest.spyOn(subjectRepository, 'findOneBy').mockResolvedValue(mockSubject as any);

      await expect(service.subscribeSubject('1', '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unsubscribeSubject', () => {
    it('should unsubscribe user from subject', async () => {
      const userWithSubject = { ...mockUser, subscribedSubjects: [mockSubject] };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithSubject as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);

      const result = await service.unsubscribeSubject('1', '1');

      expect(result.message).toContain('Đã hủy theo dõi môn học thành công');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.unsubscribeSubject('999', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if not subscribed', async () => {
      const userWithoutSubject = { ...mockUser, subscribedSubjects: [] };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithoutSubject as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(userWithoutSubject as any);

      await expect(service.unsubscribeSubject('1', '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('saveFcmToken', () => {
    it('should save FCM token for user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue({
        ...mockUser,
        fcmToken: 'new-token',
      } as any);

      const result = await service.saveFcmToken('1', 'new-token');

      expect(result.message).toContain('Đã lưu FCM token thành công');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.saveFcmToken('999', 'token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('testCreateNotifications', () => {
    it('should create test notifications', async () => {
      const mockNotifications = Array(5).fill(mockNotification);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue(mockNotifications as any);
      jest.spyOn(firebaseService, 'sendToDevice').mockResolvedValue(true);

      const result = await service.testCreateNotifications('1', 5);

      expect(result.created).toBe(5);
      expect(result.fcmSent).toBe(5);
      expect(notificationRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.testCreateNotifications('999', 5)).rejects.toThrow(NotFoundException);
    });

    it('should handle user without FCM token', async () => {
      const userWithoutToken = { ...mockUser, fcmToken: null };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithoutToken as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue([mockNotification] as any);

      const result = await service.testCreateNotifications('1', 5);

      expect(result.created).toBe(5);
      expect(result.fcmSent).toBe(0);
      expect(firebaseService.sendToDevice).not.toHaveBeenCalled();
    });

    it('should create default 20 notifications if count not specified', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest
        .spyOn(notificationRepository, 'save')
        .mockResolvedValue(Array(20).fill(mockNotification) as any);
      jest.spyOn(firebaseService, 'sendToDevice').mockResolvedValue(true);

      const result = await service.testCreateNotifications('1');

      expect(result.created).toBe(20);
    });

    it('should handle FCM send errors gracefully', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(notificationRepository, 'create').mockReturnValue(mockNotification as any);
      jest.spyOn(notificationRepository, 'save').mockResolvedValue([mockNotification] as any);
      jest.spyOn(firebaseService, 'sendToDevice').mockRejectedValue(new Error('FCM error'));

      const result = await service.testCreateNotifications('1', 1);

      expect(result.created).toBe(1);
      expect(result.fcmSent).toBe(0);
    });
  });
});
