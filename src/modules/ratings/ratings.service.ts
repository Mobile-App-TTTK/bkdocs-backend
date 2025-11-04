import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
import { ReviewsQueryDto } from './dtos/reviews.query.dto';
import { ReviewItemDto } from './dtos/review-item.dto';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { CreateReviewDto } from './dtos/create-review.dto';
import { S3Service } from '@modules/s3/s3.service';
import { LimitedReviewItemDto } from './dtos/limited-review-item.dto';

type TopKQuery = {
  documentId: string;
  k: number;
  score?: 1 | 2 | 3 | 4 | 5;
};

@Injectable()
export class RatesService {
  constructor(
    @InjectRepository(Rating) private readonly ratingRepo: Repository<Rating>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Document) private readonly documentRepo: Repository<Document>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly s3Service: S3Service,
  ) {}

  async getScoreCounts(): Promise<Array<{ score: number; count: number }>> {
    const rows = await this.ratingRepo
      .createQueryBuilder('r')
      .select('r.score', 'score')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('r.score')
      .getRawMany<{ score: string; count: string }>();

    const map: Record<number, number> = {};
    for (const r of rows) {
      const s = Number(r.score);
      map[s] = (map[s] || 0) + Number(r.count);
    }
    return [5, 4, 3, 2, 1].map((score) => ({ score, count: map[score] ?? 0 }));
  }

  async getAllDocument(dto: ReviewsQueryDto): Promise<ReviewItemDto[]> {
    const docId = (dto.documentId ?? '').toString().trim();
    if (!docId) throw new BadRequestException('documentId is required');

    const docExists = await this.documentRepo
      .createQueryBuilder('d')
      .where('d.id = :docId::uuid', { docId })
      .getExists();
    if (!docExists) throw new NotFoundException('Document not found');

    const latestCommentSub = this.commentRepo
      .createQueryBuilder('c')
      .select('c.user_id', 'user_id')
      .addSelect('c.content', 'content')
      .addSelect('c.image_url', 'image_url')      
      .addSelect('c.image_key', 'image_key')      
      .addSelect('ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at DESC)', 'rn')
      .where('c.document_id = :docId', { docId });

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .where('d.id = :docId::uuid', { docId })
      .leftJoin('ratings', 'r', 'r.document_id = d.id')
      .leftJoin('users', 'u', 'u.id = r.user_id')
      .leftJoin('(' + latestCommentSub.getQuery() + ')', 'lc', 'lc.user_id = u.id AND lc.rn = 1')
      .setParameters(latestCommentSub.getParameters())
      .select([
        'u.name AS "userName"',
        'r.score AS score',
        'lc.content AS comment',
        'lc.image_url AS "imageUrl"',
        'r.created_at AS ratedAt',
      ])
      .andWhere('r.id IS NOT NULL')
      .orderBy('r.created_at', 'DESC');

    if (dto.score !== undefined) {
      qb.andWhere('r.score = :score', { score: Number(dto.score) });
    }

    const rows = await qb.getRawMany<{
      userName: string;
      score: number;
      comment: string | null;
      imageUrl: string | null;
      ratedAt: Date;
    }>();

    return rows.map((r) => ({
      userName: r.userName,
      score: Number(r.score),
      comment: r.comment ?? null,
      imageUrl: r.imageUrl ?? null,
      ratedAt: r.ratedAt,
    }));
  }

  async createOrUpdateRatingAndComment(
    documentId: string,
    userId: string,
    dto: CreateReviewDto,
    image?: Express.Multer.File, // 🔹 nhận file
  ): Promise<void> {
    const docId = (documentId ?? '').toString().trim();
    const uId = (userId ?? '').toString().trim();
    if (!docId) throw new BadRequestException('documentId is required');
    if (!uId) throw new BadRequestException('userId is required');

    const [docExists, userExists] = await Promise.all([
      this.documentRepo.createQueryBuilder('d').where('d.id = :docId::uuid', { docId }).getExists(),
      this.userRepo.createQueryBuilder('u').where('u.id = :uId::uuid', { uId }).getExists(),
    ]);
    if (!docExists) throw new NotFoundException('Document not found');
    if (!userExists) throw new NotFoundException('User not found');

    await this.dataSource.transaction(async (manager) => {
      const ratingRepo = manager.getRepository(Rating);
      const commentRepo = manager.getRepository(Comment);

      // 1) Upsert rating
      const existingRating = await ratingRepo.findOne({
        where: { user: { id: uId }, document: { id: docId } },
      });

      if (existingRating) {
        existingRating.score = dto.score;
        await ratingRepo.save(existingRating);
      } else {
        await ratingRepo.save(
          ratingRepo.create({
            score: dto.score,
            user: { id: uId } as User,
            document: { id: docId } as Document,
          }),
        );
      }

      // 2) Upsert comment (+ ảnh)
      const existingComment = await commentRepo.findOne({
        where: { user: { id: uId }, document: { id: docId } },
      });

      // Nếu có file ảnh -> upload S3
      let newImageKey: string | null = null;
      let newImageUrl: string | null = null;

      if (image) {
        newImageKey = await this.s3Service.uploadFile(image, 'comment-images');
        // LƯU Ý: Presigned URL có hạn. Bạn đang yêu cầu lưu image_url vào DB,
        // điều này sẽ hết hạn. Nếu bucket PUBLIC, có thể lưu URL public thay thế.
        // Ở đây vẫn tạo presigned để đáp ứng yêu cầu:
        newImageUrl = await this.s3Service.getPresignedDownloadUrl(newImageKey, undefined, false, 3600);
      }

      if (existingComment) {
        existingComment.content = dto.content;
        if (image) {
          existingComment.imageKey = newImageKey;
          existingComment.imageUrl = newImageUrl;
        }
        await commentRepo.save(existingComment);
      } else {
        await commentRepo.save(
          commentRepo.create({
            content: dto.content,
            user: { id: uId } as User,
            document: { id: docId } as Document,
            imageKey: newImageKey ?? null,
            imageUrl: newImageUrl ?? null,
          }),
        );
      }
    });
  }

  async getTopKDocumentReviews(dto: TopKQuery): Promise<LimitedReviewItemDto[]> {
    const docId = (dto.documentId ?? '').toString().trim();
    const k = Number(dto.k);
    if (!docId) throw new BadRequestException('documentId is required');
    if (!Number.isFinite(k) || k <= 0) throw new BadRequestException('k must be a positive number');

    const docExists = await this.documentRepo
      .createQueryBuilder('d')
      .where('d.id = :docId::uuid', { docId })
      .getExists();
    if (!docExists) throw new NotFoundException('Document not found');

    const latestCommentSub = this.commentRepo
      .createQueryBuilder('c')
      .select('c.user_id', 'user_id')
      .addSelect('c.content', 'content')
      .addSelect('c.image_url', 'image_url')  
      .addSelect('c.image_key', 'image_key')  
      .addSelect(
        'ROW_NUMBER() OVER (PARTITION BY c.user_id ORDER BY c.created_at DESC)',
        'rn',
      )
      .where('c.document_id = :docId', { docId });

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .where('d.id = :docId::uuid', { docId })
      .leftJoin('ratings', 'r', 'r.document_id = d.id')
      .leftJoin('users', 'u', 'u.id = r.user_id')
      .leftJoin('(' + latestCommentSub.getQuery() + ')', 'lc', 'lc.user_id = u.id AND lc.rn = 1')
      .setParameters(latestCommentSub.getParameters())
      .select([
        'u.name AS "userName"',
        'r.score AS score',
        'lc.content AS comment',
        'lc.image_url AS "imageUrl"',
        'lc.image_key AS "imageKey"',
        'r.created_at AS "ratedAt"',
      ])
      .andWhere('r.id IS NOT NULL')
      .orderBy('r.created_at', 'DESC')
      .take(k);

    if (dto.score !== undefined) {
      qb.andWhere('r.score = :score', { score: Number(dto.score) });
    }

    const rows = await qb.getRawMany<{
      userName: string;
      score: string | number;
      comment: string | null;
      imageUrl: string | null;
      imageKey: string | null;
      ratedAt: Date | null;
    }>();

    const out: LimitedReviewItemDto[] = [];
    for (const r of rows) {
      let finalImageUrl = r.imageUrl ?? null;
      if (!finalImageUrl && r.imageKey) {
        try {
          finalImageUrl = await this.s3Service.getPresignedDownloadUrl(
            r.imageKey,
            'comment-image',
            false
          );
        } catch {
          finalImageUrl = null;
        }
      }

      out.push(
        new LimitedReviewItemDto({
          userName: r.userName,
          score: Number(r.score),
          comment: r.comment ?? null,
          imageUrl: finalImageUrl,
          ratedAt: r.ratedAt ?? null,
        }),
      );
    }

    return out;
  }
}