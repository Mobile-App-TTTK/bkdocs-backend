import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DocumentsService } from '../documents/documents.service';
import { UsersService } from '../users/user.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;
  let documentsService: DocumentsService;
  let usersService: UsersService;

  const mockAdminService = {
    getStatistics: jest.fn(),
    getAdminMembers: jest.fn(),
    updateUserBanStatus: jest.fn(),
  };

  const mockDocumentsService = {
    getPendingDocuments: jest.fn(),
    updateDocumentStatus: jest.fn(),
    createSubject: jest.fn(),
  };

  const mockUsersService = {
    getAllUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
    documentsService = module.get<DocumentsService>(DocumentsService);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatistics', () => {
    it('should return system statistics', async () => {
      const mockStats = { totalUsers: 100, pendingDocuments: 25 };
      mockAdminService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(adminService.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should handle zero statistics', async () => {
      mockAdminService.getStatistics.mockResolvedValue({
        totalUsers: 0,
        pendingDocuments: 0,
      });

      const result = await controller.getStatistics();

      expect(result.totalUsers).toBe(0);
      expect(result.pendingDocuments).toBe(0);
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' },
      ];
      mockUsersService.getAllUsers.mockResolvedValue(mockUsers);

      const result = await controller.getAllUsers();

      expect(usersService.getAllUsers).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('should handle empty user list', async () => {
      mockUsersService.getAllUsers.mockResolvedValue([]);

      const result = await controller.getAllUsers();

      expect(result).toEqual([]);
    });
  });



  describe('getPendingDocuments', () => {
    it('should return pending documents', async () => {
      const mockDocuments = [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'PENDING' },
      ];
      mockDocumentsService.getPendingDocuments.mockResolvedValue(mockDocuments);

      const result = await controller.getPendingDocuments();

      expect(documentsService.getPendingDocuments).toHaveBeenCalled();
      expect(result).toEqual(mockDocuments);
    });

    it('should handle no pending documents', async () => {
      mockDocumentsService.getPendingDocuments.mockResolvedValue([]);

      const result = await controller.getPendingDocuments();

      expect(result).toEqual([]);
    });
  });


});
