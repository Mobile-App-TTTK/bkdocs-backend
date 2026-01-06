import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Faculty } from '@modules/documents/entities/faculty.entity';
import { S3Service } from '@modules/s3/s3.service';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@common/enums/user-role.enum';
import { Status } from '@common/enums/status.enum';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: Repository<User>;
  let facultyRepo: Repository<Faculty>;
  let s3Service: S3Service;
  let dataSource: DataSource;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    role: UserRole.STUDENT,
    imageKey: 'avatar/user-123.jpg',
    faculty: null,
    intakeYear: 2023,
    documents: [],
    followers: [],
    following: [],
    subscribedFaculties: [],
    subscribedSubjects: [],
    createdAt: new Date('2023-01-01'),
    isVerified: false,
  };

  const mockFaculty = {
    id: 'faculty-123',
    name: 'Computer Science',
    imageUrl: 'faculty-image.jpg',
    documents: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Faculty),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadFile: jest.fn(),
            getPresignedDownloadUrl: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepo = module.get<Repository<User>>(getRepositoryToken(User));
    facultyRepo = module.get<Repository<Faculty>>(getRepositoryToken(Faculty));
    s3Service = module.get<S3Service>(S3Service);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const plainPassword = 'password123';
      const hashedPassword = 'hashedPassword';

      jest.spyOn(bcrypt, 'hash' as any).mockResolvedValue(hashedPassword);
      jest.spyOn(usersRepo, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(usersRepo, 'save').mockResolvedValue(mockUser as any);

      const result = await service.create('Test User', 'test@example.com', plainPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
      expect(usersRepo.create).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });

    it('should return null if user not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getAllUsers', () => {
    it('should return all users with profile info', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-456', email: 'user2@example.com' }];
      jest.spyOn(usersRepo, 'find').mockResolvedValue(users as any);

      const result = await service.getAllUsers();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      jest.spyOn(usersRepo, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.changePassword('user-123', { password: 'newHashedPass' });

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepo, 'update').mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.changePassword('nonexistent-id', { password: 'newPass' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyProfile', () => {
    it('should return user profile with image URL', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/image.jpg');

      const result = await service.getMyProfile('user-123');

      expect(result).toHaveProperty('id', 'user-123');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('imageUrl');
      expect(result).toHaveProperty('documentCount');
      expect(result).toHaveProperty('participationDays');
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getMyProfile('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should handle user without image', async () => {
      const userWithoutImage = { ...mockUser, imageKey: null };
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(userWithoutImage as any);

      const result = await service.getMyProfile('user-123');

      expect(result.imageUrl).toBeUndefined();
    });
  });

  describe('getProfile', () => {
    it('should return user profile with isFollowed flag', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/image.jpg');

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      };

      jest.spyOn(dataSource, 'getRepository').mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      } as any);

      const result = await service.getProfile('user-123', 'requester-123');

      expect(result).toHaveProperty('isFollowed', true);
      expect(result).toHaveProperty('id', 'user-123');
    });

    it('should return isFollowed as false when not following', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/image.jpg');

      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };

      jest.spyOn(dataSource, 'getRepository').mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      } as any);

      const result = await service.getProfile('user-123', 'requester-123');

      expect(result).toHaveProperty('isFollowed', false);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updateDto = { name: 'Updated Name', facultyId: 'faculty-123', intakeYear: 2024 };
      const updatedUser = {
        ...mockUser,
        name: 'Updated Name',
        faculty: mockFaculty,
        intakeYear: 2024,
      };

      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(facultyRepo, 'findOne').mockResolvedValue(mockFaculty as any);
      jest.spyOn(usersRepo, 'save').mockResolvedValue(updatedUser as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/image.jpg');

      const result = await service.updateProfile('user-123', updateDto);

      expect(result).toHaveProperty('name', 'Updated Name');
      expect(usersRepo.save).toHaveBeenCalled();
    });

    it('should upload avatar if file provided', async () => {
      const updateDto = { name: 'Updated Name' };
      const avatarFile = {
        buffer: Buffer.from('test'),
        originalname: 'avatar.jpg',
      } as Express.Multer.File;

      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(s3Service, 'uploadFile').mockResolvedValue('avatars/new-avatar.jpg');
      jest.spyOn(usersRepo, 'save').mockResolvedValue(mockUser as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/new-avatar.jpg');

      await service.updateProfile('user-123', updateDto, avatarFile);

      expect(s3Service.uploadFile).toHaveBeenCalledWith(avatarFile, 'avatars');
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      await expect(service.updateProfile('nonexistent-id', { name: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if faculty not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(facultyRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateProfile('user-123', { facultyId: 'invalid-faculty' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleFollowUser', () => {
    it('should follow a user', async () => {
      const follower = { ...mockUser, following: [] };
      const userToFollow = { ...mockUser, id: 'user-456' };

      jest
        .spyOn(usersRepo, 'findOne')
        .mockResolvedValueOnce(follower as any)
        .mockResolvedValueOnce(userToFollow as any);
      jest.spyOn(usersRepo, 'save').mockResolvedValue(follower as any);

      await service.toggleFollowUser('user-123', 'user-456');

      expect(usersRepo.save).toHaveBeenCalled();
    });

    it('should unfollow a user if already following', async () => {
      const userToFollow = { ...mockUser, id: 'user-456' };
      const follower = { ...mockUser, following: [userToFollow] };

      jest
        .spyOn(usersRepo, 'findOne')
        .mockResolvedValueOnce(follower as any)
        .mockResolvedValueOnce(userToFollow as any);
      jest.spyOn(usersRepo, 'save').mockResolvedValue(follower as any);

      await service.toggleFollowUser('user-123', 'user-456');

      expect(usersRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to follow self', async () => {
      await expect(service.toggleFollowUser('user-123', 'user-123')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException if follower not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      await expect(service.toggleFollowUser('invalid-id', 'user-456')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if user to follow not found', async () => {
      jest
        .spyOn(usersRepo, 'findOne')
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(null);

      await expect(service.toggleFollowUser('user-123', 'invalid-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getFollowingAndSubscribingList', () => {
    it('should return following and subscribed lists', async () => {
      const userWithRelations = {
        ...mockUser,
        following: [{ ...mockUser, id: 'user-456', documents: [], followers: [] }],
        subscribedFaculties: [mockFaculty],
        subscribedSubjects: [{ id: 'subject-123', name: 'Math', documents: [], imageUrl: null }],
      };

      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(userWithRelations as any);
      jest
        .spyOn(s3Service, 'getPresignedDownloadUrl')
        .mockResolvedValue('https://s3.url/image.jpg');

      const result = await service.getFollowingAndSubscribingList('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('followingUsers');
      expect(result[0]).toHaveProperty('subscribedFacultyIds');
      expect(result[0]).toHaveProperty('subscribedSubjectIds');
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getFollowingAndSubscribingList('nonexistent-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('upgradeUserRole', () => {
    it('should upgrade user role to ADMIN', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(usersRepo, 'save').mockResolvedValue({ ...mockUser, role: UserRole.ADMIN } as any);

      const result = await service.upgradeUserRole('user-123', UserRole.ADMIN);

      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      await expect(service.upgradeUserRole('nonexistent-id', UserRole.ADMIN)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('toggleVerifyUser', () => {
    it('should toggle user verification status', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(usersRepo, 'save').mockResolvedValue({ ...mockUser, isVerified: true } as any);

      const result = await service.toggleVerifyUser('user-123');

      expect(result.isVerified).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepo, 'findOne').mockResolvedValue(null);

      await expect(service.toggleVerifyUser('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
