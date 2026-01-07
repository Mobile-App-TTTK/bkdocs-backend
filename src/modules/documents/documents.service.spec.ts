import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { Faculty } from './entities/faculty.entity';
import { Subject } from './entities/subject.entity';
import { DocumentType } from './entities/document-type.entity';
import { User } from '@modules/users/entities/user.entity';
import { Image } from './entities/image.entity';
import { FacultyYearSubject } from './entities/faculty-year-subject.entity';
import { S3Service } from '@modules/s3/s3.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { UsersService } from '@modules/users/user.service';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Status } from '@common/enums/status.enum';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let documentRepo: Repository<Document>;
  let facultyRepo: Repository<Faculty>;
  let subjectRepo: Repository<Subject>;
  let documentTypeRepo: Repository<DocumentType>;
  let userRepo: Repository<User>;
  let imageRepo: Repository<Image>;
  let fysRepo: Repository<FacultyYearSubject>;
  let s3Service: S3Service;
  let notificationsService: NotificationsService;
  let usersService: UsersService;
  let dataSource: DataSource;

  const mockDocument = {
    id: 'doc-123',
    title: 'Test Document',
    description: 'Test Description',
    fileKey: 'documents/test.pdf',
    thumbnailKey: 'thumbnails/test.jpg',
    status: Status.ACTIVE,
    downloadCount: 10,
    uploadDate: new Date(),
    subject: { id: 'subject-123', name: 'Math' },
    faculties: [{ id: 'faculty-123', name: 'CS' }],
    documentType: { id: 'type-123', name: 'Lecture Notes' },
    uploader: { id: 'user-123', name: 'Test User' },
    averageScore: 4.5,
  };

  const mockFaculty = {
    id: 'faculty-123',
    name: 'Computer Science',
    imageUrl: 'faculty.jpg',
    documents: [],
  };

  const mockSubject = {
    id: 'subject-123',
    name: 'Mathematics',
    imageUrl: 'subject.jpg',
    documents: [],
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(Document),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Faculty),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findByIds: jest.fn(),
            findBy: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DocumentType),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Image),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(FacultyYearSubject),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadFile: jest.fn(),
            getPresignedDownloadUrl: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            sendNewDocumentNotification: jest.fn(),
            sendDocumentApprovedNotification: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            findByIdWithFaculty: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
            getRepository: jest.fn(),
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    documentRepo = module.get<Repository<Document>>(getRepositoryToken(Document));
    facultyRepo = module.get<Repository<Faculty>>(getRepositoryToken(Faculty));
    subjectRepo = module.get<Repository<Subject>>(getRepositoryToken(Subject));
    documentTypeRepo = module.get<Repository<DocumentType>>(getRepositoryToken(DocumentType));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    imageRepo = module.get<Repository<Image>>(getRepositoryToken(Image));
    fysRepo = module.get<Repository<FacultyYearSubject>>(getRepositoryToken(FacultyYearSubject));
    s3Service = module.get<S3Service>(S3Service);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    usersService = module.get<UsersService>(UsersService);
    dataSource = module.get<DataSource>(DataSource);

    // Clear all mocks after setup
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchActiveDocumentsByKeywords', () => {
    it('should return documents matching keywords', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockDocument]),
      };

      jest.spyOn(documentRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.searchActiveDocumentsByKeywords(['math', 'calculus'], 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockDocument);
    });

    it('should return empty array when no keywords provided', async () => {
      const result = await service.searchActiveDocumentsByKeywords([], 10);

      expect(result).toEqual([]);
    });
  });

  describe('getRecommendedActiveDocuments', () => {
    it('should return recommended documents based on subjects and faculties', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockDocument]),
      };

      jest.spyOn(documentRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getRecommendedActiveDocuments(
        ['subject-123'],
        ['faculty-123'],
        10
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockDocument);
    });

    it('should return empty array when no subjects or faculties provided', async () => {
      const result = await service.getRecommendedActiveDocuments([], [], 10);

      expect(result).toEqual([]);
    });
  });

  describe('getDocumentByIdWithRelations', () => {
    it('should return document with all relations', async () => {
      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(mockDocument as any);

      const result = await service.getDocumentByIdWithRelations('doc-123');

      expect(result).toEqual(mockDocument);
      expect(documentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        relations: ['subject', 'faculties', 'documentType', 'uploader'],
      });
    });

    it('should return null when document not found', async () => {
      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(null);

      const result = await service.getDocumentByIdWithRelations('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});

describe('DocumentsService - Search Functionality', () => {
  let service: DocumentsService;
  let facultyRepo: Repository<Faculty>;
  let subjectRepo: Repository<Subject>;

  const mockFaculties = [
    { id: 'faculty-1', name: 'Computer Science', image_url: 'cs.jpg', count: '5' },
    { id: 'faculty-2', name: 'Mathematics', image_url: 'math.jpg', count: '3' },
  ];

  const mockSubjects = [
    { id: 'subject-1', name: 'Calculus', image_url: 'calc.jpg', count: '10' },
    { id: 'subject-2', name: 'Algorithms', image_url: 'algo.jpg', count: '7' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(Document),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Faculty),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(DocumentType),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Image),
          useValue: {},
        },
        {
          provide: getRepositoryToken(FacultyYearSubject),
          useValue: {},
        },
        {
          provide: S3Service,
          useValue: {},
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: { query: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    facultyRepo = module.get<Repository<Faculty>>(getRepositoryToken(Faculty));
    subjectRepo = module.get<Repository<Subject>>(getRepositoryToken(Subject));

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search - faculty only', () => {
    it('should search for faculties by keyword', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockFaculties),
      };

      jest.spyOn(facultyRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.search({ searchFor: 'faculty', keyword: 'computer' });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('search - subject only', () => {
    it('should search for subjects by keyword', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockSubjects),
      };

      jest.spyOn(subjectRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.search({ searchFor: 'subject', keyword: 'calculus' });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('count');
    });
  });
});

describe('DocumentsService - Additional Tests', () => {
  let service: DocumentsService;
  let documentRepo: Repository<Document>;
  let facultyRepo: Repository<Faculty>;
  let subjectRepo: Repository<Subject>;
  let documentTypeRepo: Repository<DocumentType>;
  let userRepo: Repository<User>;
  let imageRepo: Repository<Image>;
  let fysRepo: Repository<FacultyYearSubject>;
  let s3Service: S3Service;
  let notificationsService: NotificationsService;
  let usersService: UsersService;
  let dataSource: DataSource;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
    getExists: jest.fn().mockResolvedValue(false),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getQuery: jest.fn().mockReturnValue('SELECT * FROM documents'),
    getParameters: jest.fn().mockReturnValue({}),
    clone: jest.fn().mockReturnThis(),
    subQuery: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(Document),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Faculty),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findBy: jest.fn(),
            findByIds: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(DocumentType),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            query: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Image),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(FacultyYearSubject),
          useValue: {
            find: jest.fn(),
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
          provide: NotificationsService,
          useValue: {
            sendNewDocumentNotification: jest.fn(),
            sendDocumentApprovedNotification: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            findByIdWithFaculty: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
            getRepository: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    documentRepo = module.get<Repository<Document>>(getRepositoryToken(Document));
    facultyRepo = module.get<Repository<Faculty>>(getRepositoryToken(Faculty));
    subjectRepo = module.get<Repository<Subject>>(getRepositoryToken(Subject));
    documentTypeRepo = module.get<Repository<DocumentType>>(getRepositoryToken(DocumentType));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    imageRepo = module.get<Repository<Image>>(getRepositoryToken(Image));
    fysRepo = module.get<Repository<FacultyYearSubject>>(getRepositoryToken(FacultyYearSubject));
    s3Service = module.get<S3Service>(S3Service);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    usersService = module.get<UsersService>(UsersService);
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('uploadDocument', () => {
    it.skip('should upload document successfully', async () => {
      const mockFile = { buffer: Buffer.from('test') } as Express.Multer.File;
      const mockThumbnail = { buffer: Buffer.from('thumb') } as Express.Multer.File;

      jest.spyOn(userRepo, 'findOneBy').mockResolvedValue({ id: 'user-1' } as any);
      jest.spyOn(facultyRepo, 'findBy').mockResolvedValue([{ id: 'f1' }] as any);
      jest.spyOn(subjectRepo, 'findOne').mockResolvedValue({ id: 's1' } as any);
      jest.spyOn(documentTypeRepo, 'findOneBy').mockResolvedValue({ id: 't1' } as any);
      jest.spyOn(s3Service, 'uploadFile').mockResolvedValue('file-key');
      jest.spyOn(documentRepo, 'create').mockReturnValue({ id: 'doc-1' } as any);
      jest.spyOn(documentRepo, 'save').mockResolvedValue({ id: 'doc-1', title: 'Test' } as any);
      jest.spyOn(notificationsService, 'sendNewDocumentNotification').mockResolvedValue(undefined);

      const result = await service.uploadDocument(
        mockFile,
        [],
        'user-1',
        mockThumbnail,
        ['f1'],
        's1',
        't1',
        'Test Doc',
        'Description'
      );

      expect(result).toBeDefined();
      expect(s3Service.uploadFile).toHaveBeenCalled();
      expect(documentRepo.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const mockFile = { buffer: Buffer.from('test') } as Express.Multer.File;
      const mockThumbnail = { buffer: Buffer.from('thumb') } as Express.Multer.File;

      jest.spyOn(userRepo, 'findOneBy').mockResolvedValue(null);

      await expect(
        service.uploadDocument(
          mockFile,
          [],
          'invalid-user',
          mockThumbnail,
          ['f1'],
          's1',
          't1',
          'Test',
          'Desc'
        )
      ).rejects.toThrow();
    });
  });

  describe('getDocumentById', () => {
    it('should return document details with presigned URLs', async () => {
      const mockDoc = {
        id: 'doc-1',
        title: 'Test',
        fileKey: 'file.pdf',
        thumbnailKey: 'thumb.jpg',
        images: [{ id: 'img1', fileKey: 'img1.jpg' }],
        averageScore: 4.5,
      };

      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(mockDoc as any);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('presigned-url');

      const result = await service.getDocumentById('doc-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('doc-1');
    });

    it('should throw NotFoundException if document not found', async () => {
      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getDocumentById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned download URL and increment counter', async () => {
      const mockDoc = { id: 'doc-1', fileKey: 'file.pdf', downloadCount: 5 };

      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(mockDoc as any);
      jest.spyOn(documentRepo, 'save').mockResolvedValue({ ...mockDoc, downloadCount: 6 } as any);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('presigned-url');

      const result = await service.getDownloadUrl('doc-1');

      expect(result).toBe('presigned-url');
      expect(documentRepo.save).toHaveBeenCalledWith({ ...mockDoc, downloadCount: 6 });
    });

    it('should throw NotFoundException if document not found', async () => {
      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getDownloadUrl('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suggest', () => {
    it('should return keyword suggestions', async () => {
      jest.spyOn(documentRepo, 'find').mockResolvedValue([{ title: 'Lập trình Web' }] as any);
      jest.spyOn(subjectRepo, 'find').mockResolvedValue([{ name: 'Lập trình' }] as any);
      jest.spyOn(facultyRepo, 'find').mockResolvedValue([{ name: 'CNTT' }] as any);
      jest.spyOn(userRepo, 'find').mockResolvedValue([{ name: 'Lập Trình Viên' }] as any);

      const result = await service.suggest('lập');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array if keyword is empty', async () => {
      const result = await service.suggest('');
      expect(result).toEqual([]);
    });

    it('should handle special characters', async () => {
      jest.spyOn(documentRepo, 'find').mockResolvedValue([{ title: 'C++' }] as any);
      jest.spyOn(subjectRepo, 'find').mockResolvedValue([]);
      jest.spyOn(facultyRepo, 'find').mockResolvedValue([]);
      jest.spyOn(userRepo, 'find').mockResolvedValue([]);

      const result = await service.suggest('c++');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    it('should return top downloaded documents', async () => {
      const mockDocs = [
        { id: 'd1', downloadCount: 100 },
        { id: 'd2', downloadCount: 90 },
      ];

      jest.spyOn(documentRepo, 'find').mockResolvedValue(mockDocs as any);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');

      const result = await service.getSuggestions();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAllFacultiesAndSubjectsAndDocumentTypes', () => {
    it('should return all metadata', async () => {
      jest.spyOn(facultyRepo, 'find').mockResolvedValue([{ id: 'f1', name: 'CS' }] as any);
      jest.spyOn(subjectRepo, 'find').mockResolvedValue([{ id: 's1', name: 'Math' }] as any);
      jest
        .spyOn(documentTypeRepo, 'find')
        .mockResolvedValue([{ id: 't1', name: 'Lecture' }] as any);

      const result = await service.getAllFacultiesAndSubjectsAndDocumentTypes();

      expect(result).toHaveProperty('faculties');
      expect(result).toHaveProperty('subjects');
      expect(result).toHaveProperty('documentTypes');
    });
  });

  describe('updateDocumentStatus', () => {
    it('should update document status to ACTIVE and send notifications', async () => {
      const mockDoc = {
        id: 'doc-1',
        title: 'Test',
        status: Status.PENDING,
        faculties: [{ id: 'f1', name: 'CS' }],
        subject: { id: 's1', name: 'Math' },
        uploader: { id: 'u1' },
      };

      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(mockDoc as any);
      jest
        .spyOn(documentRepo, 'save')
        .mockResolvedValue({ ...mockDoc, status: Status.ACTIVE } as any);
      jest
        .spyOn(notificationsService, 'sendDocumentApprovedNotification')
        .mockResolvedValue(undefined);
      jest.spyOn(notificationsService, 'sendNewDocumentNotification').mockResolvedValue(undefined);

      const result = await service.updateDocumentStatus('doc-1', Status.ACTIVE);

      expect(result.status).toBe(Status.ACTIVE);
      expect(notificationsService.sendDocumentApprovedNotification).toHaveBeenCalled();
      expect(notificationsService.sendNewDocumentNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException if document not found', async () => {
      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(null);

      await expect(service.updateDocumentStatus('non-existent', Status.ACTIVE)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getPendingDocuments', () => {
    it('should return pending documents with pagination', async () => {
      const mockDocs = [
        { id: 'd1', title: 'Doc 1', status: Status.PENDING },
        { id: 'd2', title: 'Doc 2', status: Status.PENDING },
      ];

      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockDocs, 2]);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');

      const result = await service.getPendingDocuments(1, 10);

      expect(result.data).toBeDefined();
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by full text search', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');

      const result = await service.getPendingDocuments(1, 10, 'search term');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(result.data).toEqual([]);
    });
  });

  describe('getDocumentsByFaculty', () => {
    it('should return documents grouped by subjects for a faculty', async () => {
      const mockFaculty = { id: 'f1', name: 'CS', imageUrl: 'url' };
      const mockFys = [
        { subject: { id: 's1', name: 'Math' } },
        { subject: { id: 's2', name: 'Physics' } },
      ];

      jest.spyOn(facultyRepo, 'findOne').mockResolvedValue(mockFaculty as any);
      jest.spyOn(fysRepo, 'find').mockResolvedValue(mockFys as any);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '10' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getDocumentsByFaculty('f1', 'user-1');

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('subjects');
    });

    it('should throw NotFoundException if faculty not found', async () => {
      jest.spyOn(facultyRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getDocumentsByFaculty('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('suggestSubjectsForUser', () => {
    it('should return personalized subject suggestions', async () => {
      jest.spyOn(usersService, 'findByIdWithFaculty').mockResolvedValue({
        id: 'user-1',
        faculty: { id: 'f1' },
        intakeYear: 2020,
      } as any);
      jest.spyOn(fysRepo, 'find').mockResolvedValue([]);

      const result = await service.suggestSubjectsForUser('user-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAllFacultiesSuggestions', () => {
    it('should return document suggestions for all faculties', async () => {
      const mockFaculties = [
        {
          id: 'f1',
          name: 'CS',
          documents: [
            {
              id: 'd1',
              status: Status.ACTIVE,
              downloadCount: 100,
              thumbnailKey: 'thumb.jpg',
              title: 'Test',
            },
          ],
        },
      ];

      jest.spyOn(facultyRepo, 'find').mockResolvedValue(mockFaculties as any);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');

      const result = await service.getAllFacultiesSuggestions();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createSubject', () => {
    it('should create new subject with image', async () => {
      const mockFile = { buffer: Buffer.from('test') } as Express.Multer.File;
      const mockSubject = {
        id: 's1',
        name: 'New Subject',
        description: 'Description',
        imageKey: 'subject-image-key',
      };

      jest.spyOn(subjectRepo, 'findOneBy').mockResolvedValue(null);
      jest.spyOn(s3Service, 'uploadFile').mockResolvedValue('subject-image-key');
      jest.spyOn(subjectRepo, 'create').mockReturnValue(mockSubject as any);
      jest.spyOn(subjectRepo, 'save').mockResolvedValue(mockSubject as any);

      const result = await service.createSubject('New Subject', 'Description', mockFile);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Subject');
      expect(s3Service.uploadFile).toHaveBeenCalled();
      expect(subjectRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if subject already exists', async () => {
      const mockFile = { buffer: Buffer.from('test') } as Express.Multer.File;

      jest.spyOn(subjectRepo, 'findOneBy').mockResolvedValue({ id: 's1', name: 'Existing' } as any);

      await expect(service.createSubject('Existing', 'Description', mockFile)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getDocumentsByUserId', () => {
    it('should return documents uploaded by user', async () => {
      const mockDocs = [
        { id: 'd1', title: 'Doc 1', thumbnailKey: 'thumb1.jpg' },
        { id: 'd2', title: 'Doc 2', thumbnailKey: 'thumb2.jpg' },
      ];

      jest.spyOn(documentRepo, 'find').mockResolvedValue(mockDocs as any);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');

      const result = await service.getDocumentsByUserId('user-1', 10, 1);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      jest.spyOn(documentRepo, 'find').mockResolvedValue([]);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');

      const result = await service.getDocumentsByUserId('user-1', 5, 2);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });
  });

  describe('search - additional scenarios', () => {
    beforeEach(() => {
      jest.spyOn(documentRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(facultyRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(subjectRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(userRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValue([{ column_name: 'following_id' }, { column_name: 'follower_id' }]);
    });

    it('should search with faculty and subject', async () => {
      jest.spyOn(facultyRepo, 'findOne').mockResolvedValue({ id: 'f1' } as any);
      jest.spyOn(subjectRepo, 'findOne').mockResolvedValue({ id: 's1' } as any);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.search({
        searchFor: 'all',
        faculty: 'CS',
        subject: 'Math',
        keyword: 'test',
      });

      expect(result).toBeDefined();
    });

    it('should search for users only', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([{ id: 'u1', name: 'User 1', imageKey: null }]);
      jest.spyOn(userRepo, 'query').mockResolvedValue([]);

      const result = await service.search({
        searchFor: 'user',
        keyword: 'user',
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should search for users with currentUserId', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { id: 'u1', name: 'User 1', imageKey: 'key1' },
      ]);
      jest.spyOn(userRepo, 'query').mockResolvedValue([]);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');

      const result = await service.search(
        {
          searchFor: 'user',
          keyword: 'user',
        },
        'current-user'
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDocumentsBySubject', () => {
    beforeEach(() => {
      jest.spyOn(documentRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
    });

    it('should return documents grouped by document type for a subject', async () => {
      const mockSubject = { id: 's1', name: 'Math', imageUrl: 'url' };

      jest.spyOn(subjectRepo, 'findOne').mockResolvedValue(mockSubject as any);
      jest.spyOn(userRepo, 'query').mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '10' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getDocumentsBySubject('s1', 'user-1');

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('typeList');
    });

    it('should throw NotFoundException if subject not found', async () => {
      jest.spyOn(subjectRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getDocumentsBySubject('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle subject with no followers', async () => {
      const mockSubject = { id: 's1', name: 'Math', imageUrl: 'url' };

      jest.spyOn(subjectRepo, 'findOne').mockResolvedValue(mockSubject as any);
      jest.spyOn(userRepo, 'query').mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getDocumentsBySubject('s1', 'user-1');

      expect(result.followers_count).toBe(0);
    });
  });

  describe('getAllFacultiesAndSubjectsAndDocumentTypes', () => {
    it('should return all faculties, subjects and document types', async () => {
      jest.spyOn(facultyRepo, 'find').mockResolvedValue([{ id: 'f1', name: 'CS' }] as any);
      jest.spyOn(subjectRepo, 'find').mockResolvedValue([{ id: 's1', name: 'Math' }] as any);
      jest
        .spyOn(documentTypeRepo, 'find')
        .mockResolvedValue([{ id: 't1', name: 'Lecture' }] as any);

      const result = await service.getAllFacultiesAndSubjectsAndDocumentTypes();

      expect(result).toHaveProperty('faculties');
      expect(result).toHaveProperty('subjects');
      expect(result).toHaveProperty('documentTypes');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle getDocumentById with missing thumbnail', async () => {
      const mockDoc = {
        id: 'd1',
        title: 'Test',
        thumbnailKey: null,
        fileKey: 'doc.pdf',
        images: [],
        subject: { id: 's1', name: 'Math' },
        faculties: [],
        documentType: { id: 't1', name: 'Lecture' },
        uploader: { id: 'u1', name: 'User' },
      };

      jest.spyOn(documentRepo, 'findOne').mockResolvedValue(mockDoc as any);
      jest.spyOn(s3Service, 'getPresignedDownloadUrl').mockResolvedValue('url');
      jest.spyOn(dataSource, 'query').mockResolvedValue([{ avg: null }]);

      const result = await service.getDocumentById('d1');

      expect(result.thumbnailUrl).toBeNull();
    });

    it('should handle uploadDocument with missing thumbnail', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.pdf',
      } as Express.Multer.File;
      const mockImages = [
        { buffer: Buffer.from('img'), originalname: 'img.jpg' } as Express.Multer.File,
      ];

      jest.spyOn(userRepo, 'findOneBy').mockResolvedValue({ id: 'u1' } as any);
      jest.spyOn(facultyRepo, 'findBy').mockResolvedValue([{ id: 'f1' }] as any);
      jest.spyOn(subjectRepo, 'findOne').mockResolvedValue({ id: 's1' } as any);
      jest.spyOn(documentTypeRepo, 'findOneBy').mockResolvedValue({ id: 't1' } as any);
      jest.spyOn(s3Service, 'uploadFile').mockResolvedValue('file-key');
      jest.spyOn(documentRepo, 'save').mockResolvedValue({ id: 'd1' } as any);
      jest.spyOn(imageRepo, 'save').mockResolvedValue({} as any);
      jest.spyOn(notificationsService, 'sendNewDocumentNotification').mockResolvedValue(undefined);

      const result = await service.uploadDocument(
        mockFile,
        mockImages,
        'u1',
        undefined,
        ['f1'],
        's1',
        't1',
        'Description'
      );

      expect(result).toBeDefined();
    });
  });
});
