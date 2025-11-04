import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
import { ReviewsQueryDto } from './dtos/reviews.query.dto';
import { ReviewItemDto } from './dtos/review-item.dto'
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { CreateReviewDto } from './dtos/create-review.dto';

@Injectable()
export class RatesService {
    constructor(
        @InjectRepository(Rating) private readonly ratingRepo: Repository<Rating>,
        @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
        @InjectRepository(Document) private readonly documentRepo: Repository<Document>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        private readonly dataSource: DataSource,
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

        const scores = [5, 4, 3, 2, 1];
        return scores.map(score => ({ score, count: map[score] ?? 0 }));
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
                'r.created_at AS ratedAt',
            ])
            .andWhere('r.id IS NOT NULL')       
            .orderBy('r.created_at', 'DESC');

        if (dto.score !== undefined) {
            qb.andWhere('r.score = :score', { score: Number(dto.score) });
        }

        const rows = await qb.getRawMany<{ userName: string; score: number; comment: string | null }>();
        return rows.map(r => ({
            userName: r.userName,
            score: Number(r.score),
            comment: r.comment ?? null,
        }));
    }

    async createOrUpdateRatingAndComment(documentId: string, userId: string, dto: CreateReviewDto): Promise<void> {
        const docId = (documentId ?? '').toString().trim();
        const uId   = (userId ?? '').toString().trim();
        if (!docId) throw new BadRequestException('documentId is required');
        if (!uId)   throw new BadRequestException('userId is required');

        const [docExists, userExists] = await Promise.all([
            this.documentRepo.createQueryBuilder('d').where('d.id = :docId::uuid', { docId }).getExists(),
            this.userRepo.createQueryBuilder('u').where('u.id = :uId::uuid', { uId }).getExists(),
        ]);
        if (!docExists)  throw new NotFoundException('Document not found');
        if (!userExists) throw new NotFoundException('User not found');

        await this.dataSource.transaction(async (manager) => {
            const ratingRepo = manager.getRepository(Rating);
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

            const commentRepo = manager.getRepository(Comment);
            const existingComment = await commentRepo.findOne({
                where: { user: { id: uId }, document: { id: docId } },
            });

            if (existingComment) {
                existingComment.content = dto.content;       
                await commentRepo.save(existingComment);
            } else {
                await commentRepo.save(
                    commentRepo.create({
                        content: dto.content,
                        user: { id: uId } as User,
                        document: { id: docId } as Document,
                    }),
                );
            }
        });
    }
}
