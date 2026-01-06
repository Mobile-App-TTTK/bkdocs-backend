import { Test, TestingModule } from '@nestjs/testing';
import { RatesController } from './ratings.controller';
import { RatesService } from './ratings.service';

describe('RatesController', () => {
  let controller: RatesController;
  let ratesService: RatesService;

  const mockRatesService = {
    getScoreCounts: jest.fn(),
    getAllDocument: jest.fn(),
    createOrUpdateReview: jest.fn(),
    deleteReview: jest.fn(),
    getMyReview: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RatesController],
      providers: [
        {
          provide: RatesService,
          useValue: mockRatesService,
        },
      ],
    }).compile();

    controller = module.get<RatesController>(RatesController);
    ratesService = module.get<RatesService>(RatesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getScoreCounts', () => {
    it('should return score counts', async () => {
      const mockCounts = [
        { score: 5, count: 10 },
        { score: 4, count: 5 },
      ];
      mockRatesService.getScoreCounts.mockResolvedValue(mockCounts);

      const result = await controller.getScoreCounts();

      expect(ratesService.getScoreCounts).toHaveBeenCalled();
      expect(result).toEqual(mockCounts);
    });

    it('should handle empty counts', async () => {
      mockRatesService.getScoreCounts.mockResolvedValue([]);

      const result = await controller.getScoreCounts();

      expect(result).toEqual([]);
    });
  });

  describe('getAllDocument', () => {
    it('should return all reviews for document', async () => {
      const documentId = 'doc-1';
      const mockReviews = [
        { id: '1', score: 5, content: 'Great!' },
        { id: '2', score: 4, content: 'Good' },
      ];
      mockRatesService.getAllDocument.mockResolvedValue(mockReviews);

      const result = await controller.getAllDocument(documentId);

      expect(ratesService.getAllDocument).toHaveBeenCalledWith({
        documentId: 'doc-1',
        score: undefined,
      });
      expect(result).toEqual(mockReviews);
    });

    it('should filter reviews by score', async () => {
      const documentId = 'doc-1';
      const score = '5';
      mockRatesService.getAllDocument.mockResolvedValue([{ score: 5 }]);

      await controller.getAllDocument(documentId, score);

      expect(ratesService.getAllDocument).toHaveBeenCalledWith({
        documentId: 'doc-1',
        score: 5,
      });
    });

    it('should throw error if documentId is missing', async () => {
      await expect(controller.getAllDocument('', undefined)).rejects.toThrow();
    });

    it('should throw error for invalid score', async () => {
      await expect(controller.getAllDocument('doc-1', '6')).rejects.toThrow();
    });

    it('should accept valid scores 1-5', async () => {
      mockRatesService.getAllDocument.mockResolvedValue([]);

      for (const score of ['1', '2', '3', '4', '5']) {
        await controller.getAllDocument('doc-1', score);
        expect(ratesService.getAllDocument).toHaveBeenCalledWith({
          documentId: 'doc-1',
          score: parseInt(score),
        });
      }
    });
  });

  describe('createReview', () => {
    it('should create review', async () => {
      const documentId = 'doc-1';
      const dto = { score: 5, content: 'Excellent!' };
      const req = { user: { userId: 'user-1' } };
      const file = { buffer: Buffer.from('test') } as Express.Multer.File;
      mockRatesService.createOrUpdateRatingAndComment.mockResolvedValue(undefined);

      await controller.createReview(documentId, dto, file, req);

      expect(ratesService.createOrUpdateRatingAndComment).toHaveBeenCalledWith(
        'doc-1',
        'user-1',
        dto,
        file
      );
    });

    it('should create review without image', async () => {
      const documentId = 'doc-1';
      const dto = { score: 4, content: 'Good' };
      const req = { user: { userId: 'user-1' } };
      mockRatesService.createOrUpdateRatingAndComment.mockResolvedValue(undefined);

      await controller.createReview(documentId, dto, undefined, req);

      expect(ratesService.createOrUpdateRatingAndComment).toHaveBeenCalledWith(
        'doc-1',
        'user-1',
        dto,
        undefined
      );
    });
  });

  describe('deleteReview', () => {
    it('should delete review', async () => {
      const documentId = 'doc-1';
      const req = { user: { userId: 'user-1' } };
      mockRatesService.deleteReview.mockResolvedValue({ message: 'Deleted' });

      const result = await controller.deleteReview(documentId, req);

      expect(ratesService.deleteReview).toHaveBeenCalledWith('user-1', 'doc-1');
      expect(result.message).toBe('Deleted');
    });

    it('should handle delete errors', async () => {
      const req = { user: { userId: 'user-1' } };
      mockRatesService.deleteReview.mockRejectedValue(new Error('Not found'));

      await expect(controller.deleteReview('doc-1', req)).rejects.toThrow('Not found');
    });
  });

  describe('getMyReview', () => {
    it('should return user review for document', async () => {
      const documentId = 'doc-1';
      const req = { user: { userId: 'user-1' } };
      const mockReview = { id: '1', score: 5, content: 'Great!' };
      mockRatesService.getMyReview.mockResolvedValue(mockReview);

      const result = await controller.getMyReview(documentId, req);

      expect(ratesService.getMyReview).toHaveBeenCalledWith('user-1', 'doc-1');
      expect(result).toEqual(mockReview);
    });

    it('should return null if no review', async () => {
      const req = { user: { userId: 'user-1' } };
      mockRatesService.getMyReview.mockResolvedValue(null);

      const result = await controller.getMyReview('doc-1', req);

      expect(result).toBeNull();
    });
  });
});
