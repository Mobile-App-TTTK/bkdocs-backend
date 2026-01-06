import { Test, TestingModule } from '@nestjs/testing';
import { RatesService } from './ratings.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Rating } from './entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { User } from '@modules/users/entities/user.entity';
import { S3Service } from '@modules/s3/s3.service';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RatesService', () => {
  let service: RatesService;
  let ratingRepo: Repository<Rating>;
  let commentRepo: Repository<Comment>;
  let documentRepo: Repository<Document>;
  let userRepo: Repository<User>;
  let s3Service: S3Service;
  let dataSource: DataSource;

  const mockRating = {
    id: 'rating-123',
    score: 5,
    user: { id: 'user-123', name: 'Test User' },
    document: { id: 'doc-123', title: 'Test Doc' },
    createdAt: new Date(),
  };

  const mockDocument = {
    id: 'doc-123',
    title: 'Test Document',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatesService,
        {
          provide: getRepositoryToken(Rating),
          useValue: {
            createQueryBuilder: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Comment),
          useValue: {
            createQueryBuilder: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Document),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: S3Service,
          useValue: {
            getPresignedDownloadUrl: jest.fn(),
            uploadFile: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RatesService>(RatesService);
    ratingRepo = module.get<Repository<Rating>>(getRepositoryToken(Rating));
    commentRepo = module.get<Repository<Comment>>(getRepositoryToken(Comment));
    documentRepo = module.get<Repository<Document>>(getRepositoryToken(Document));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    s3Service = module.get<S3Service>(S3Service);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getScoreCounts', () => {
    it('should return score counts for all ratings', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { score: '5', count: '10' },
          { score: '4', count: '8' },
          { score: '3', count: '5' },
        ]),
      };

      jest.spyOn(ratingRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getScoreCounts();

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ score: 5, count: 10 });
      expect(result[1]).toEqual({ score: 4, count: 8 });
      expect(result[2]).toEqual({ score: 3, count: 5 });
      expect(result[3]).toEqual({ score: 2, count: 0 });
      expect(result[4]).toEqual({ score: 1, count: 0 });
    });

    it('should return zero counts when no ratings exist', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(ratingRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getScoreCounts();

      expect(result).toHaveLength(5);
      result.forEach((item) => {
        expect(item.count).toBe(0);
      });
    });
  });

  describe('getAllDocument', () => {
    it('should return reviews for a document', async () => {
      const mockReviews = [
        {
          userName: 'User One',
          score: 5,
          comment: 'Great document',
          imageUrl: null,
          imageKey: null,
          ratedAt: new Date(),
        },
      ];

      const mockDocQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(true),
      };

      const mockCommentQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('subquery'),
        getParameters: jest.fn().mockReturnValue({}),
      };

      const mockReviewsQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockReviews),
      };

      jest
        .spyOn(documentRepo, 'createQueryBuilder')
        .mockReturnValueOnce(mockDocQueryBuilder as any)
        .mockReturnValueOnce(mockReviewsQueryBuilder as any);

      jest.spyOn(commentRepo, 'createQueryBuilder').mockReturnValue(mockCommentQueryBuilder as any);

      const result = await service.getAllDocument({ documentId: 'doc-123' });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('userName', 'User One');
      expect(result[0]).toHaveProperty('score', 5);
    });

    it('should throw BadRequestException if documentId is missing', async () => {
      await expect(service.getAllDocument({ documentId: '' })).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if document does not exist', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(false),
      };

      jest.spyOn(documentRepo, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(service.getAllDocument({ documentId: 'nonexistent-id' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should filter reviews by score when provided', async () => {
      const mockDocQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(true),
      };

      const mockCommentQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getQuery: jest.fn().mockReturnValue('subquery'),
        getParameters: jest.fn().mockReturnValue({}),
      };

      const mockReviewsQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      jest
        .spyOn(documentRepo, 'createQueryBuilder')
        .mockReturnValueOnce(mockDocQueryBuilder as any)
        .mockReturnValueOnce(mockReviewsQueryBuilder as any);

      jest.spyOn(commentRepo, 'createQueryBuilder').mockReturnValue(mockCommentQueryBuilder as any);

      await service.getAllDocument({ documentId: 'doc-123', score: 5 });

      expect(mockReviewsQueryBuilder.andWhere).toHaveBeenCalledWith('r.score = :score', {
        score: 5,
      });
    });
  });
});
