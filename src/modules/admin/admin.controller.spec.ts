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
    getAllMembers: jest.fn(),
    updateUserBanStatus: jest.fn(),
  };

  const mockDocumentsService = {
    approveDocument: jest.fn(),
    rejectDocument: jest.fn(),
    getPendingDocuments: jest.fn(),
    deleteDocument: jest.fn(),
    addFaculty: jest.fn(),
    addSubject: jest.fn(),
    addDocumentType: jest.fn(),
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

  describe('approveDocument', () => {
    it('should approve document', async () => {
      const documentId = 'doc-1';
      const req = { user: { userId: 'admin-1' } };
      const mockDocument = { id: documentId, status: 'ACTIVE' };
      mockDocumentsService.approveDocument.mockResolvedValue(mockDocument);

      const result = await controller.approveDocument(documentId, req);

      expect(documentsService.approveDocument).toHaveBeenCalledWith(documentId, 'admin-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('should handle approval errors', async () => {
      const req = { user: { userId: 'admin-1' } };
      mockDocumentsService.approveDocument.mockRejectedValue(new Error('Not found'));

      await expect(controller.approveDocument('doc-1', req)).rejects.toThrow('Not found');
    });
  });

  describe('rejectDocument', () => {
    it('should reject document', async () => {
      const documentId = 'doc-1';
      const req = { user: { userId: 'admin-1' } };
      mockDocumentsService.rejectDocument.mockResolvedValue({ message: 'Rejected' });

      const result = await controller.rejectDocument(documentId, req);

      expect(documentsService.rejectDocument).toHaveBeenCalledWith(documentId);
      expect(result.message).toBe('Rejected');
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

  describe('deleteDocument', () => {
    it('should delete document', async () => {
      const documentId = 'doc-1';
      mockDocumentsService.deleteDocument.mockResolvedValue({ message: 'Deleted' });

      const result = await controller.deleteDocument(documentId);

      expect(documentsService.deleteDocument).toHaveBeenCalledWith(documentId);
      expect(result.message).toBe('Deleted');
    });
  });

  describe('getAllMembers', () => {
    it('should return all members', async () => {
      const mockMembers = [
        { id: '1', name: 'Member 1', banStatus: 'NONE' },
        { id: '2', name: 'Member 2', banStatus: 'BANNED' },
      ];
      mockAdminService.getAllMembers.mockResolvedValue(mockMembers);

      const result = await controller.getAllMembers();

      expect(adminService.getAllMembers).toHaveBeenCalled();
      expect(result).toEqual(mockMembers);
    });
  });

  describe('banUser', () => {
    it('should ban user', async () => {
      const userId = 'user-1';
      const dto = { banStatus: 'BANNED' };
      mockAdminService.updateUserBanStatus.mockResolvedValue({
        message: 'User banned',
      });

      const result = await controller.banUser(userId, dto);

      expect(adminService.updateUserBanStatus).toHaveBeenCalledWith(userId, 'BANNED');
      expect(result.message).toContain('banned');
    });

    it('should unban user', async () => {
      const userId = 'user-1';
      const dto = { banStatus: 'NONE' };
      mockAdminService.updateUserBanStatus.mockResolvedValue({
        message: 'User unbanned',
      });

      const result = await controller.banUser(userId, dto);

      expect(adminService.updateUserBanStatus).toHaveBeenCalledWith(userId, 'NONE');
    });
  });

  describe('addFaculty', () => {
    it('should add new faculty', async () => {
      const dto = { name: 'Khoa CNTT', imageUrl: 'https://example.com/image.jpg' };
      mockDocumentsService.addFaculty.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.addFaculty(dto);

      expect(documentsService.addFaculty).toHaveBeenCalledWith(dto.name, dto.imageUrl);
      expect(result.name).toBe('Khoa CNTT');
    });
  });

  describe('addSubject', () => {
    it('should add new subject', async () => {
      const dto = { name: 'Lập trình Web', imageUrl: 'https://example.com/img.jpg' };
      mockDocumentsService.addSubject.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.addSubject(dto);

      expect(documentsService.addSubject).toHaveBeenCalledWith(dto.name, dto.imageUrl);
      expect(result.name).toBe('Lập trình Web');
    });
  });

  describe('addDocumentType', () => {
    it('should add new document type', async () => {
      const dto = { name: 'Bài giảng' };
      mockDocumentsService.addDocumentType.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.addDocumentType(dto);

      expect(documentsService.addDocumentType).toHaveBeenCalledWith(dto.name);
      expect(result.name).toBe('Bài giảng');
    });
  });
});
