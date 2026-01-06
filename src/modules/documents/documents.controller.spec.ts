import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Logger } from '@nestjs/common';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documentsService: DocumentsService;

  const mockDocumentsService = {
    search: jest.fn(),
    suggest: jest.fn(),
    suggestSubjectsForUser: jest.fn(),
    getDownloadUrl: jest.fn(),
    getSuggestions: jest.fn(),
    getAllFacultiesSuggestions: jest.fn(),
    uploadDocument: jest.fn(),
    getDocumentById: jest.fn(),
    getAllFacultiesAndSubjectsAndDocumentTypes: jest.fn(),
    getDocumentsByFaculty: jest.fn(),
    getDocumentsBySubject: jest.fn(),
    updateDocument: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
    documentsService = module.get<DocumentsService>(DocumentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('should search documents by keyword', async () => {
      const query = { keyword: 'test', faculty: '', subject: '' };
      const req = { user: { userId: 'user-1' } };
      const mockResults = [{ id: '1', title: 'Test Doc' }];
      mockDocumentsService.search.mockResolvedValue(mockResults);

      const result = await controller.search(query, req);

      expect(documentsService.search).toHaveBeenCalledWith(query, 'user-1');
      expect(result).toEqual(mockResults);
    });

    it('should search by faculty', async () => {
      const query = { keyword: '', faculty: 'CNTT', subject: '' };
      const req = { user: { userId: 'user-1' } };
      mockDocumentsService.search.mockResolvedValue([]);

      await controller.search(query, req);

      expect(documentsService.search).toHaveBeenCalledWith(query, 'user-1');
    });

    it('should search by subject', async () => {
      const query = { keyword: '', faculty: '', subject: 'Web' };
      const req = { user: { userId: 'user-1' } };
      mockDocumentsService.search.mockResolvedValue([]);

      await controller.search(query, req);

      expect(documentsService.search).toHaveBeenCalled();
    });

    it('should throw error if all fields are empty', async () => {
      const query = { keyword: '', faculty: '', subject: '' };
      const req = { user: { userId: 'user-1' } };

      await expect(controller.search(query, req)).rejects.toThrow();
    });
  });

  describe('suggest', () => {
    it('should suggest keywords', async () => {
      const keyword = 'lap';
      mockDocumentsService.suggest.mockResolvedValue(['Lập trình', 'Lập trình Web']);

      const result = await controller.suggest(keyword);

      expect(documentsService.suggest).toHaveBeenCalledWith('lap');
      expect(result).toHaveLength(2);
    });

    it('should throw error if keyword is empty', async () => {
      await expect(controller.suggest('')).rejects.toThrow();
    });
  });

  describe('suggestSubject', () => {
    it('should suggest subjects for user', async () => {
      const req = { user: { userId: 'user-1' } };
      const mockSubjects = [{ id: '1', name: 'Web' }];
      mockDocumentsService.suggestSubjectsForUser.mockResolvedValue(mockSubjects);

      const result = await controller.suggestSubject(req);

      expect(documentsService.suggestSubjectsForUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockSubjects);
    });
  });

  describe('download', () => {
    it('should return download URL', async () => {
      const documentId = 'doc-1';
      const mockUrl = 'https://s3.example.com/file.pdf';
      mockDocumentsService.getDownloadUrl.mockResolvedValue(mockUrl);

      const result = await controller.download(documentId);

      expect(documentsService.getDownloadUrl).toHaveBeenCalledWith(documentId);
      expect(result.url).toBe(mockUrl);
    });

    it('should handle different document IDs', async () => {
      mockDocumentsService.getDownloadUrl.mockResolvedValue('url');

      await controller.download('doc-2');

      expect(documentsService.getDownloadUrl).toHaveBeenCalledWith('doc-2');
    });
  });

  describe('getSuggestions', () => {
    it('should return top download documents', async () => {
      const mockDocs = [
        { id: '1', downloads: 100 },
        { id: '2', downloads: 90 },
      ];
      mockDocumentsService.getSuggestions.mockResolvedValue(mockDocs);

      const result = await controller.getSuggestions();

      expect(documentsService.getSuggestions).toHaveBeenCalled();
      expect(result).toEqual(mockDocs);
    });
  });

  describe('getAllFacultiesSuggestions', () => {
    it('should return suggestions for all faculties', async () => {
      const mockSuggestions = [{ facultyId: '1', facultyName: 'CNTT', documents: [] }];
      mockDocumentsService.getAllFacultiesSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getAllFacultiesSuggestions();

      expect(documentsService.getAllFacultiesSuggestions).toHaveBeenCalled();
      expect(result).toEqual(mockSuggestions);
    });
  });

  describe('uploadFile', () => {
    it('should upload document', async () => {
      const req = { user: { userId: 'user-1' } };
      const files = {
        file: [{ buffer: Buffer.from('test') } as Express.Multer.File],
        thumbnailFile: [{ buffer: Buffer.from('thumb') } as Express.Multer.File],
        images: [],
      };
      const mockDoc = { id: '1', title: 'Test Doc' };
      mockDocumentsService.uploadDocument.mockResolvedValue(mockDoc as any);

      const result = await controller.uploadFile(
        files,
        ['faculty-1'],
        'subject-1',
        'type-1',
        'Test Doc',
        'Description',
        req
      );

      expect(documentsService.uploadDocument).toHaveBeenCalled();
      expect(result.title).toBe('Test Doc');
    });
  });

  describe('getDocumentById', () => {
    it('should return document details', async () => {
      const documentId = 'doc-1';
      const mockDoc = { id: documentId, title: 'Test Doc' };
      mockDocumentsService.getDocumentById.mockResolvedValue(mockDoc as any);

      const result = await controller.getDocumentById(documentId);

      expect(documentsService.getDocumentById).toHaveBeenCalledWith(documentId);
      expect(result).toEqual(mockDoc);
    });
  });

  describe('getAllFacultiesAndSubjectsAndDocumentTypes', () => {
    it('should return all faculties and subjects and document types', async () => {
      const mockData = {
        faculties: [{ id: '1', name: 'CNTT' }],
        subjects: [{ id: '1', name: 'Web' }],
        documentTypes: [{ id: '1', name: 'Lecture' }],
      };
      mockDocumentsService.getAllFacultiesAndSubjectsAndDocumentTypes.mockResolvedValue(
        mockData as any
      );

      const result = await controller.getAllFacultiesAndSubjectsAndDocumentTypes();

      expect(documentsService.getAllFacultiesAndSubjectsAndDocumentTypes).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
  });

  describe('getDocumentsByFaculty', () => {
    it('should return documents by faculty', async () => {
      const facultyId = 'faculty-1';
      const req = { user: { userId: 'user-1' } };
      const mockDocs = [{ id: '1', title: 'Doc 1' }];
      mockDocumentsService.getDocumentsByFaculty.mockResolvedValue(mockDocs as any);

      const result = await controller.getDocumentsByFaculty(facultyId, req);

      expect(documentsService.getDocumentsByFaculty).toHaveBeenCalledWith(facultyId, 'user-1');
      expect(result).toEqual(mockDocs);
    });

    it('should handle empty faculty results', async () => {
      const facultyId = 'empty-faculty';
      const req = { user: { userId: 'user-1' } };
      mockDocumentsService.getDocumentsByFaculty.mockResolvedValue({ subjects: [] } as any);

      const result = await controller.getDocumentsByFaculty(facultyId, req);

      expect(result).toBeDefined();
    });

    it('should handle non-existent faculty', async () => {
      const facultyId = 'non-existent';
      const req = { user: { userId: 'user-1' } };
      mockDocumentsService.getDocumentsByFaculty.mockRejectedValue(new Error('Faculty not found'));

      await expect(controller.getDocumentsByFaculty(facultyId, req)).rejects.toThrow(
        'Faculty not found'
      );
    });
  });

  describe('uploadFile - additional tests', () => {
    it('should upload document with multiple images', async () => {
      const req = { user: { userId: 'user-1' } };
      const files = {
        file: [{ buffer: Buffer.from('test') } as Express.Multer.File],
        thumbnailFile: [{ buffer: Buffer.from('thumb') } as Express.Multer.File],
        images: [
          { buffer: Buffer.from('img1') } as Express.Multer.File,
          { buffer: Buffer.from('img2') } as Express.Multer.File,
        ],
      };
      const mockDoc = { id: '1', title: 'Doc with images' };
      mockDocumentsService.uploadDocument.mockResolvedValue(mockDoc as any);

      const result = await controller.uploadFile(
        files,
        ['faculty-1'],
        'subject-1',
        'type-1',
        'Doc with images',
        'Has multiple images',
        req
      );

      expect(result.title).toBe('Doc with images');
    });

    it('should upload document with string facultyIds', async () => {
      const req = { user: { userId: 'user-1' } };
      const files = {
        file: [{ buffer: Buffer.from('test') } as Express.Multer.File],
        thumbnailFile: [{ buffer: Buffer.from('thumb') } as Express.Multer.File],
        images: [],
      };
      mockDocumentsService.uploadDocument.mockResolvedValue({ id: '1' } as any);

      await controller.uploadFile(
        files,
        'faculty-1,faculty-2' as any,
        'subject-1',
        'type-1',
        'Test',
        'Test',
        req
      );

      expect(documentsService.uploadDocument).toHaveBeenCalled();
    });

    it('should handle upload errors', async () => {
      const req = { user: { userId: 'user-1' } };
      const files = {
        file: [{ buffer: Buffer.from('test') } as Express.Multer.File],
        thumbnailFile: [{ buffer: Buffer.from('thumb') } as Express.Multer.File],
        images: [],
      };
      mockDocumentsService.uploadDocument.mockRejectedValue(new Error('Upload failed'));

      await expect(
        controller.uploadFile(files, ['faculty-1'], 'subject-1', 'type-1', 'Test', 'Test', req)
      ).rejects.toThrow('Upload failed');
    });
  });

  describe('search - additional tests', () => {
    it('should search with combined filters', async () => {
      const query = { keyword: 'test', faculty: 'CNTT', subject: 'Web' };
      const req = { user: { userId: 'user-1' } };
      mockDocumentsService.search.mockResolvedValue([{ id: '1' }]);

      await controller.search(query, req);

      expect(documentsService.search).toHaveBeenCalledWith(query, 'user-1');
    });

    it('should handle search with special characters', async () => {
      const query = { keyword: 'c++', faculty: '', subject: '' };
      const req = { user: { userId: 'user-1' } };
      mockDocumentsService.search.mockResolvedValue([]);

      await controller.search(query, req);

      expect(documentsService.search).toHaveBeenCalled();
    });

    it('should handle search without user', async () => {
      const query = { keyword: 'test', faculty: '', subject: '' };
      const req = { user: { userId: undefined } };
      mockDocumentsService.search.mockResolvedValue([]);

      await controller.search(query, req);

      expect(documentsService.search).toHaveBeenCalledWith(query, undefined);
    });
  });

  describe('download - additional tests', () => {
    it('should increment download count', async () => {
      const documentId = 'doc-1';
      mockDocumentsService.getDownloadUrl.mockResolvedValue('url');

      await controller.download(documentId);

      expect(documentsService.getDownloadUrl).toHaveBeenCalledWith(documentId);
    });

    it('should handle invalid document ID', async () => {
      mockDocumentsService.getDownloadUrl.mockRejectedValue(new Error('Document not found'));

      await expect(controller.download('invalid-id')).rejects.toThrow('Document not found');
    });

    it('should handle S3 errors', async () => {
      mockDocumentsService.getDownloadUrl.mockRejectedValue(new Error('S3 error'));

      await expect(controller.download('doc-1')).rejects.toThrow('S3 error');
    });
  });

  describe('getDocumentById - additional tests', () => {
    it('should return document with all relations', async () => {
      const mockDoc = {
        id: 'doc-1',
        title: 'Test Doc',
        author: { id: 'user-1', name: 'Author' },
        faculties: [{ id: 'f1', name: 'CNTT' }],
        subject: { id: 's1', name: 'Web' },
        images: [{ id: 'img1', url: 'url1' }],
      };
      mockDocumentsService.getDocumentById.mockResolvedValue(mockDoc as any);

      const result = await controller.getDocumentById('doc-1');

      expect(result).toHaveProperty('author');
      expect(result).toHaveProperty('faculties');
    });

    it('should handle document not found', async () => {
      mockDocumentsService.getDocumentById.mockRejectedValue(new Error('Document not found'));

      await expect(controller.getDocumentById('non-existent')).rejects.toThrow(
        'Document not found'
      );
    });
  });

  describe('getSuggestions - additional tests', () => {
    it('should return suggestions sorted by downloads', async () => {
      const mockDocs = [
        { id: '1', downloadCount: 100 },
        { id: '2', downloadCount: 90 },
        { id: '3', downloadCount: 80 },
      ];
      mockDocumentsService.getSuggestions.mockResolvedValue(mockDocs as any);

      const result = await controller.getSuggestions();

      expect(result).toHaveLength(3);
      expect(result[0].downloadCount).toBeGreaterThanOrEqual(result[1].downloadCount);
    });

    it('should handle empty suggestions', async () => {
      mockDocumentsService.getSuggestions.mockResolvedValue([]);

      const result = await controller.getSuggestions();

      expect(result).toEqual([]);
    });
  });

  describe('getAllFacultiesSuggestions - additional tests', () => {
    it('should return suggestions with documents per faculty', async () => {
      const mockData = [
        {
          facultyId: 'f1',
          facultyName: 'CNTT',
          documents: [{ id: 'd1' }, { id: 'd2' }],
        },
        {
          facultyId: 'f2',
          facultyName: 'Cơ khí',
          documents: [{ id: 'd3' }],
        },
      ];
      mockDocumentsService.getAllFacultiesSuggestions.mockResolvedValue(mockData as any);

      const result = await controller.getAllFacultiesSuggestions();

      expect(result).toHaveLength(2);
      expect(result[0].documents).toBeDefined();
    });

    it('should handle faculties with no documents', async () => {
      const mockData = [
        {
          facultyId: 'f1',
          facultyName: 'Empty Faculty',
          documents: [],
        },
      ];
      mockDocumentsService.getAllFacultiesSuggestions.mockResolvedValue(mockData as any);

      const result = await controller.getAllFacultiesSuggestions();

      expect(result[0].documents).toEqual([]);
    });
  });

  describe('suggestSubject - additional tests', () => {
    it('should return personalized subject suggestions', async () => {
      const req = { user: { userId: 'user-1' } };
      const mockSubjects = [
        { id: 's1', name: 'Web' },
        { id: 's2', name: 'Mobile' },
        { id: 's3', name: 'AI' },
      ];
      mockDocumentsService.suggestSubjectsForUser.mockResolvedValue(mockSubjects);

      const result = await controller.suggestSubject(req);

      expect(result).toHaveLength(3);
    });

    it('should handle user with no history', async () => {
      const req = { user: { userId: 'new-user' } };
      mockDocumentsService.suggestSubjectsForUser.mockResolvedValue([]);

      const result = await controller.suggestSubject(req);

      expect(result).toEqual([]);
    });
  });

  describe('getAllFacultiesAndSubjectsAndDocumentTypes - additional tests', () => {
    it('should return complete metadata', async () => {
      const mockData = {
        faculties: [
          { id: 'f1', name: 'CNTT' },
          { id: 'f2', name: 'Cơ khí' },
        ],
        subjects: [
          { id: 's1', name: 'Web' },
          { id: 's2', name: 'Mobile' },
        ],
        documentTypes: [
          { id: 't1', name: 'Bài giảng' },
          { id: 't2', name: 'Đề thi' },
        ],
      };
      mockDocumentsService.getAllFacultiesAndSubjectsAndDocumentTypes.mockResolvedValue(
        mockData as any
      );

      const result = await controller.getAllFacultiesAndSubjectsAndDocumentTypes();

      expect(result.faculties).toHaveLength(2);
      expect(result.subjects).toHaveLength(2);
      expect(result.documentTypes).toHaveLength(2);
    });

    it('should handle empty metadata', async () => {
      const mockData = {
        faculties: [],
        subjects: [],
        documentTypes: [],
      };
      mockDocumentsService.getAllFacultiesAndSubjectsAndDocumentTypes.mockResolvedValue(
        mockData as any
      );

      const result = await controller.getAllFacultiesAndSubjectsAndDocumentTypes();

      expect(result.faculties).toEqual([]);
    });
  });
});
