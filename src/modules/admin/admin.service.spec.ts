import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { S3Service } from '@modules/s3/s3.service';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Status } from '@common/enums/status.enum';
import { BanStatus } from '@modules/users/enums/ban-status.enum';

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: Repository<User>;
  let documentRepo: Repository<Document>;
  let s3Service: S3Service;

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    imageKey: 'avatars/user-123.jpg',
    banStatus: BanStatus.NONE,
    followers: [],
    documents: [],
  };

  const mockDocument = {
    id: 'doc-123',
    title: 'Test Document',
    status: Status.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            count: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Document),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            getPresignedDownloadUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    documentRepo = module.get<Repository<Document>>(getRepositoryToken(Document));
    s3Service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatistics', () => {
    it('should return total users and pending documents count', async () => {
      jest.spyOn(userRepo, 'count').mockResolvedValue(100);
      jest.spyOn(documentRepo, 'count').mockResolvedValue(15);

      const result = await service.getStatistics();

      expect(result).toEqual({
        totalUsers: 100,
        pendingDocuments: 15,
      });
      expect(documentRepo.count).toHaveBeenCalledWith({
        where: { status: Status.PENDING },
      });
    });

    it('should return zero when no users or documents exist', async () => {
      jest.spyOn(userRepo, 'count').mockResolvedValue(0);
      jest.spyOn(documentRepo, 'count').mockResolvedValue(0);

      const result = await service.getStatistics();

      expect(result).toEqual({
        totalUsers: 0,
        pendingDocuments: 0,
      });
    });
  });

  describe('getAdminMembers', () => {
    it('should return list of admin members with their info', async () => {
      const users = [
        { ...mockUser, followers: [{}, {}], documents: [{}, {}, {}] },
        { ...mockUser, id: 'user-456', imageKey: null, followers: [], documents: [] },
      ];

      jest.spyOn(userRepo, 'find').mockResolvedValue(users as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/image.jpg');

      const result = await service.getAdminMembers();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'user-123');
      expect(result[0]).toHaveProperty('name', 'Test User');
      expect(result[0]).toHaveProperty('imageUrl');
      expect(result[0]).toHaveProperty('isBanned', false);
      expect(result[0]).toHaveProperty('followerCount', 2);
      expect(result[0]).toHaveProperty('uploadedDocumentsCount', 3);
      expect(result[1]).toHaveProperty('imageUrl', undefined);
    });

    it('should correctly identify banned users', async () => {
      const bannedUser = { ...mockUser, banStatus: BanStatus.BANNED };

      jest.spyOn(userRepo, 'find').mockResolvedValue([bannedUser] as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/image.jpg');

      const result = await service.getAdminMembers();

      expect(result[0]).toHaveProperty('isBanned', true);
    });
  });

  describe('updateUserBanStatus', () => {
    it('should update user ban status successfully', async () => {
      const updatedUser = { ...mockUser, banStatus: BanStatus.BANNED };

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepo, 'save').mockResolvedValue(updatedUser as any);

      const result = await service.updateUserBanStatus('admin-123', 'user-123', BanStatus.BANNED);

      expect(result).toEqual({
        id: 'user-123',
        name: 'Test User',
        banStatus: BanStatus.BANNED,
      });
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when admin tries to ban themselves', async () => {
      await expect(
        service.updateUserBanStatus('user-123', 'user-123', BanStatus.BANNED)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid ban status', async () => {
      await expect(
        service.updateUserBanStatus('admin-123', 'user-123', 'INVALID_STATUS' as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateUserBanStatus('admin-123', 'nonexistent-id', BanStatus.BANNED)
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow admin to unban a user', async () => {
      const bannedUser = { ...mockUser, banStatus: BanStatus.BANNED };
      const unbannedUser = { ...mockUser, banStatus: BanStatus.NONE };

      jest.spyOn(userRepo, 'findOne').mockResolvedValue(bannedUser as any);
      jest.spyOn(userRepo, 'save').mockResolvedValue(unbannedUser as any);

      const result = await service.updateUserBanStatus('admin-123', 'user-123', BanStatus.NONE);

      expect(result.banStatus).toBe(BanStatus.NONE);
    });

    it('should allow user to ban/unban themselves when not banning', async () => {
      jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepo, 'save').mockResolvedValue(mockUser as any);

      const result = await service.updateUserBanStatus('user-123', 'user-123', BanStatus.NONE);

      expect(result).toHaveProperty('banStatus', BanStatus.NONE);
    });
  });
});
