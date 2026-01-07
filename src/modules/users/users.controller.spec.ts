import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './user.service';
import { DocumentsService } from '../documents/documents.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let documentsService: DocumentsService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  const mockUsersService = {
    getMyProfile: jest.fn(),
    updateProfile: jest.fn(),
    toggleFollowUser: jest.fn(),
    getFollowingAndSubscribingList: jest.fn(),
    getProfile: jest.fn(),
  };

  const mockDocumentsService = {
    getDocumentsByUserId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    documentsService = module.get<DocumentsService>(DocumentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = { user: { userId: '1' } };
      mockUsersService.getMyProfile.mockResolvedValue(mockUser);

      const result = await controller.getProfile(req);

      expect(usersService.getMyProfile).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockUser);
    });

    it('should handle different user IDs', async () => {
      const req = { user: { userId: '2' } };
      mockUsersService.getMyProfile.mockResolvedValue({ id: '2' });

      await controller.getProfile(req);

      expect(usersService.getMyProfile).toHaveBeenCalledWith('2');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const req = { user: { userId: '1' } };
      const name = 'Updated Name';
      const file = { buffer: Buffer.from('test') } as Express.Multer.File;
      mockUsersService.updateProfile.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      } as any);

      const result = await controller.updateProfile(req, name, undefined, undefined, file);

      expect(usersService.updateProfile).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('should update profile without file', async () => {
      const req = { user: { userId: '1' } };
      const name = 'New Name';
      mockUsersService.updateProfile.mockResolvedValue(mockUser as any);

      await controller.updateProfile(req, name, undefined, undefined, undefined);

      expect(usersService.updateProfile).toHaveBeenCalled();
    });
  });

  describe('toggleFollowUser', () => {
    it('should toggle follow a user', async () => {
      const req = { user: { userId: '1' } };
      const targetUserId = '2';
      mockUsersService.toggleFollowUser.mockResolvedValue(undefined);

      await controller.toggleFollowUser(req, targetUserId);

      expect(usersService.toggleFollowUser).toHaveBeenCalledWith('1', '2');
    });

    it('should handle follow errors', async () => {
      const req = { user: { userId: '1' } };
      mockUsersService.toggleFollowUser.mockRejectedValue(new Error('Cannot follow yourself'));

      await expect(controller.toggleFollowUser(req, '1')).rejects.toThrow('Cannot follow yourself');
    });
  });

  describe('getFollowingAndSubscribingList', () => {
    it('should return following and subscribing list', async () => {
      const req = { user: { userId: '1' } };
      const mockData = [
        { id: '2', name: 'User 2' },
      ];
      mockUsersService.getFollowingAndSubscribingList.mockResolvedValue(mockData);

      const result = await controller.getFollowingAndSubscribingList(req);

      expect(usersService.getFollowingAndSubscribingList).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockData);
    });
  });

  describe('getUserDocuments', () => {
    it('should return user documents', async () => {
      const userId = '1';
      const mockDocuments = [
        { id: '1', title: 'Doc 1' },
        { id: '2', title: 'Doc 2' },
      ];
      mockDocumentsService.getDocumentsByUserId.mockResolvedValue(mockDocuments);

      const result = await controller.getUserDocuments(userId, 10, 1);

      expect(documentsService.getDocumentsByUserId).toHaveBeenCalledWith(userId, 10, 1);
      expect(result).toEqual(mockDocuments);
    });

    it('should handle empty documents', async () => {
      mockDocumentsService.getDocumentsByUserId.mockResolvedValue([]);

      const result = await controller.getUserDocuments('1', 10, 1);

      expect(result).toEqual([]);
    });
  });

  describe('getUserProfile', () => {
    it('should return specific user profile', async () => {
      const userId = '2';
      const req = { user: { userId: '1' } };
      mockUsersService.getProfile.mockResolvedValue({ id: '2', name: 'User 2' });

      const result = await controller.getUserProfile(userId, req);

      expect(usersService.getProfile).toHaveBeenCalledWith('2', '1');
      expect(result.id).toBe('2');
    });

    it('should handle non-existent user', async () => {
      const req = { user: { userId: '1' } };
      mockUsersService.getProfile.mockRejectedValue(new Error('User not found'));

      await expect(controller.getUserProfile('999', req)).rejects.toThrow('User not found');
    });
  });
});
