import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ILike, Repository, DeepPartial, In, DataSource } from 'typeorm';

import { Document } from './entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { S3Service } from '@modules/s3/s3.service';
import { FacultyYearSubject } from './entities/faculty-year-subject.entity';
import { UsersService } from '@modules/users/user.service';

import { SuggestAllFacultiesDocumentsResponseDto } from './dtos/responses/suggestAllFacultiesDocument.response.dto';
import { User } from '@modules/users/entities/user.entity';
import { Faculty } from '@modules/documents/entities/faculty.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { DocumentType } from '@modules/documents/entities/document-type.entity';
import { AllFacultiesAndSubjectsAndDocumentTypesDto } from './dtos/responses/allFalcutiesAndSubjects.response.dto';
import { DocumentResponseDto } from './dtos/responses/document.response.dto';
import { Image } from './entities/image.entity';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Status } from '@common/enums/status.enum';
import { ApiOkResponse } from '@nestjs/swagger';

type SlimDoc = {
  id: string;
  title: string;
  downloadCount: number;
  uploadDate: Date;
  subject: { name: string } | null;
  faculty: { name: string } | null;
  thumbnail: string | null;
  score: number | null;
  type: string | null;
};

type SubjectGroup = {
  name: string | null;
  documents: Array<{
    id: string;
    title: string;
    downloadCount: number;
    uploadDate: Date;
    thumbnail: string | null;
    score: number | null;
    type: string | null;
  }>;
};

type FacultyDocumentsResponse = {
  name: string;
  imageUrl: string | null;
  isFollowingFaculty: boolean;
  document_count: number;
  followers_count: number;
  subjects: SubjectGroup[];
};

type SubjectDocumentsResponse = {
  name: string;
  isFollowingSubject: boolean;
  document_count: number;
  followers_count: number;
  imageUrl: string | null;
  typeList: Array<{
    name: string | null;
    documents: SlimDoc[];
  }>;
};

function qi(name: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private ufColsCache?: { targetCol: string; followerCol: string };

  /**
   * Search active documents by keywords for AI chatbot.
   * Returns up to limit documents matching any of the keywords.
   */
  async searchActiveDocumentsByKeywords(keywords: string[], limit = 10): Promise<Document[]> {
    if (keywords.length === 0) return [];

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.subject', 'subject')
      .leftJoinAndSelect('d.faculties', 'faculty')
      .leftJoinAndSelect('d.documentType', 'documentType')
      .where('d.status = :status', { status: Status.ACTIVE });

    keywords.forEach((keyword, index) => {
      const paramKey = `keyword${index}`;
      const condition = `(
        unaccent(d.title) ILIKE unaccent(:${paramKey}) OR
        unaccent(d.description) ILIKE unaccent(:${paramKey}) OR
        unaccent(subject.name) ILIKE unaccent(:${paramKey}) OR
        unaccent(documentType.name) ILIKE unaccent(:${paramKey})
      )`;
      const paramValue = `%${keyword}%`;
      if (index === 0) {
        qb.andWhere(condition, { [paramKey]: paramValue });
      } else {
        qb.orWhere(condition, { [paramKey]: paramValue });
      }
    });

    return qb
      .orderBy('d.downloadCount', 'DESC')
      .addOrderBy('d.uploadDate', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Get recommended active documents based on user's subscribed subjects and faculties.
   * Returns up to limit documents for AI chatbot recommendations.
   */
  async getRecommendedActiveDocuments(
    subjectIds: string[],
    facultyIds: string[],
    limit = 10
  ): Promise<Document[]> {
    if (subjectIds.length === 0 && facultyIds.length === 0) {
      return [];
    }

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.subject', 'subject')
      .leftJoinAndSelect('d.faculties', 'faculty')
      .leftJoinAndSelect('d.documentType', 'documentType')
      .where('d.status = :status', { status: Status.ACTIVE });

    if (subjectIds.length > 0 && facultyIds.length > 0) {
      qb.andWhere('(subject.id IN (:...subjectIds) OR faculty.id IN (:...facultyIds))', {
        subjectIds,
        facultyIds,
      });
    } else if (subjectIds.length > 0) {
      qb.andWhere('subject.id IN (:...subjectIds)', { subjectIds });
    } else if (facultyIds.length > 0) {
      qb.andWhere('faculty.id IN (:...facultyIds)', { facultyIds });
    }

    return qb
      .orderBy('d.downloadCount', 'DESC')
      .addOrderBy('d.uploadDate', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Get document by ID with full relations for AI chatbot.
   */
  async getDocumentByIdWithRelations(documentId: string): Promise<Document | null> {
    return this.documentRepo.findOne({
      where: { id: documentId },
      relations: ['subject', 'faculties', 'documentType', 'uploader'],
    });
  }

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(FacultyYearSubject) private readonly fysRepo: Repository<FacultyYearSubject>,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepo: Repository<DocumentType>,
    @InjectRepository(Image)
    private readonly imageRepo: Repository<Image>,
    private readonly s3Service: S3Service,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource
  ) {}

  private async resolveUserFollowerColumns(): Promise<{ targetCol: string; followerCol: string }> {
    if (this.ufColsCache) return this.ufColsCache;

    const cols: Array<{ column_name: string }> = await this.dataSource.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_followers'
    ORDER BY ordinal_position
  `);
    const names = cols.map((c) => c.column_name);

    if (names.includes('following_id') && names.includes('follower_id')) {
      this.ufColsCache = { targetCol: 'following_id', followerCol: 'follower_id' };
      return this.ufColsCache;
    }

    const candidates = [
      { targetCol: 'users_id_1', followerCol: 'users_id_2' },
      { targetCol: 'user_id_1', followerCol: 'user_id_2' },
      { targetCol: 'userid_1', followerCol: 'userid_2' },
      { targetCol: 'userId_1', followerCol: 'userId_2' },
      { targetCol: 'usersId_1', followerCol: 'usersId_2' },
    ];
    const found = candidates.find(
      (p) => names.includes(p.targetCol) && names.includes(p.followerCol)
    );
    if (found) {
      this.ufColsCache = found;
      return found;
    }

    const fkRows: Array<{ column_name: string }> = await this.dataSource.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_name = 'user_followers'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users' AND ccu.column_name = 'id'
  `);

    const fkCols = fkRows.map((r) => r.column_name);
    const maybeFollowing = fkCols.find((c) => /follow.*ing/i.test(c));
    const maybeFollower = fkCols.find((c) => /follower/i.test(c));

    if (maybeFollowing && maybeFollower) {
      this.ufColsCache = { targetCol: maybeFollowing, followerCol: maybeFollower };
      return this.ufColsCache;
    }

    if (fkCols.length >= 2) {
      const [c1, c2] = fkCols;
      this.ufColsCache = { targetCol: c1, followerCol: c2 };
      this.logger
        .warn(`[resolveUserFollowerColumns] Không phân biệt được follower/following rõ ràng.
      Đang tạm coi "${c1}" = following_id (target), "${c2}" = follower_id.`);
      return this.ufColsCache;
    }

    throw new Error('Không xác định được cột của user_followers. Hãy đặt thủ công.');
  }

  async search(q: SearchDocumentsDto, currentUserId?: string): Promise<any> {
    const faculty = q.faculty?.trim();
    const subject = q.subject?.trim();
    const keyword = q.keyword?.trim();
    const searchFor = q.searchFor ?? 'all';

    // ========== FACULTY ONLY ==========
    if (searchFor === 'faculty' && keyword) {
      const kw = `%${keyword}%`;
      const rows = await this.facultyRepo
        .createQueryBuilder('f')
        .leftJoin('f.curricula', 'fy')
        .leftJoin('fy.subject', 's')
        .leftJoin('f.documents', 'd')
        .where('f.name ILIKE :kw', { kw })
        .orWhere('s.name ILIKE :kw', { kw })
        .andWhere('d.status = :status', { status: Status.ACTIVE })
        .select([
          'f.id AS id',
          'f.name AS name',
          'f.image_url AS image_url',
          'COUNT(d.id) AS count',
        ])
        .groupBy('f.id')
        .addGroupBy('f.name')
        .addGroupBy('f.image_url')
        .getRawMany<{ id: string; name: string; image_url: string | null; count: string }>();

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        count: Number(r.count) || 0,
        image_url: r.image_url ?? null,
      }));
    }

    // ========== SUBJECT ONLY ==========
    if (searchFor === 'subject' && keyword) {
      const kw = `%${keyword}%`;
      const rows = await this.subjectRepo
        .createQueryBuilder('s')
        .leftJoin('s.documents', 'd')
        .where(
          new Brackets((b) => {
            b.where('s.name ILIKE :kw', { kw }).orWhere('d.title ILIKE :kw', { kw });
          })
        )
        .select([
          's.id AS id',
          's.name AS name',
          's.image_url AS image_url',
          'COUNT(CASE WHEN d.status = :activeStatus THEN d.id END) AS count',
        ])
        .setParameter('activeStatus', Status.ACTIVE)
        .groupBy('s.id')
        .addGroupBy('s.name')
        .addGroupBy('s.image_url')
        .getRawMany<{ id: string; name: string; image_url: string | null; count: string }>();

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        count: Number(r.count) || 0,
        image_url: r.image_url ?? null,
      }));
    }

    // ========== USER ONLY (image_url từ S3) ==========
    if (searchFor === 'user' && keyword) {
      const kw = `%${keyword}%`;

      const baseUsers = await this.userRepo
        .createQueryBuilder('u')
        .where('u.name ILIKE :kw', { kw })
        .orWhere(`split_part(u.email, '@', 1) ILIKE :kw`, { kw })
        .select(['u.id AS id', 'u.name AS name', 'u.image_key AS "imageKey"'])
        .orderBy('u.name', 'ASC')
        .getRawMany<{ id: string; name: string; imageKey: string | null }>();

      if (baseUsers.length === 0) return [];

      const ids = baseUsers.map((u) => u.id);
      const { targetCol, followerCol } = await this.resolveUserFollowerColumns();

      const followerRows = await this.userRepo.query(
        `SELECT ${qi(targetCol)} AS id, COUNT(*)::int AS "followersCount"
        FROM user_followers
        WHERE ${qi(targetCol)} = ANY($1)
        GROUP BY ${qi(targetCol)}`,
        [ids]
      );
      const followersCountMap = new Map<string, number>(
        followerRows.map((r: any) => [r.id, Number(r.followersCount) || 0])
      );

      const docRows = await this.documentRepo
        .createQueryBuilder('d')
        .leftJoin('d.uploader', 'up')
        .where('up.id IN (:...ids)', { ids })
        .andWhere('d.status = :status', { status: Status.ACTIVE })
        .select('up.id', 'id')
        .addSelect('COUNT(d.id)', 'documentsCount')
        .groupBy('up.id')
        .getRawMany<{ id: string; documentsCount: string }>();
      const documentsCountMap = new Map<string, number>(
        docRows.map((r) => [r.id, Number(r.documentsCount) || 0])
      );

      let isFollowingSet = new Set<string>();
      if (currentUserId) {
        const followedRows = await this.userRepo.query(
          `SELECT ${qi(targetCol)} AS id
          FROM user_followers
          WHERE ${qi(followerCol)} = $1 AND ${qi(targetCol)} = ANY($2)`,
          [currentUserId, ids]
        );
        isFollowingSet = new Set(followedRows.map((r: any) => r.id));
      }

      const users = await Promise.all(
        baseUsers.map(async (u) => {
          let image_url: string | null = null;
          if (u.imageKey) {
            try {
              image_url = await this.s3Service.getPresignedDownloadUrl(
                u.imageKey,
                u.name || undefined,
                false
              );
            } catch {
              image_url = null;
            }
          }

          return {
            id: u.id,
            name: u.name,
            image_url,
            followersCount: followersCountMap.get(u.id) ?? 0,
            documentsCount: documentsCountMap.get(u.id) ?? 0,
            isFollowing: currentUserId ? isFollowingSet.has(u.id) : false,
          };
        })
      );

      return users;
    }

    // ========== ALL: documents + users + subjects + faculties ==========
    if (searchFor === 'all') {
      // ----- Documents -----
      const qb = this.documentRepo
        .createQueryBuilder('d')
        .leftJoin('d.subject', 'subject')
        .leftJoin('d.faculties', 'faculty')
        .leftJoin('d.ratings', 'rating')
        .select([
          'd.id AS d_id',
          'd.title AS d_title',
          'd.description AS d_description',
          'd.file_key AS d_file_key',
          'd.download_count AS d_download_count',
          'd.upload_date AS d_upload_date',
          'd.thumbnail_key AS d_thumbnail_key',
          'subject.name AS subject_name',
          'faculty.name AS faculty_name',
          'AVG(rating.score) AS rating_score',
        ]);

      if (faculty) {
        qb.andWhere('faculty.name ILIKE :facultyName', { facultyName: `%${faculty}%` });
      }
      if (subject) {
        qb.andWhere('subject.name ILIKE :subjectName', { subjectName: `%${subject}%` });
      }
      if (keyword) {
        qb.andWhere(
          new Brackets((b) => {
            b.where('d.title ILIKE :kw')
              .orWhere('d.description ILIKE :kw')
              .orWhere(`split_part(d.thumbnail_key, '.', 1) ILIKE :kw`)
              .orWhere(`split_part(d.file_key, '.', 1) ILIKE :kw`);
          }),
          { kw: `%${keyword}%` }
        );
      }

      qb.andWhere('d.status = :status', { status: Status.ACTIVE });

      qb.groupBy('d.id')
        .addGroupBy('d.title')
        .addGroupBy('d.description')
        .addGroupBy('d.download_count')
        .addGroupBy('d.upload_date')
        .addGroupBy('d.thumbnail_key')
        .addGroupBy('d.file_key')
        .addGroupBy('subject.name')
        .addGroupBy('faculty.name');

      const docsPromise = (async () => {
        const rows = await qb.getRawMany<{
          d_id: string;
          d_title: string;
          d_description: string | null;
          d_file_key: string | null;
          d_download_count: number;
          d_upload_date: Date;
          d_thumbnail_key: string | null;
          subject_name: string | null;
          faculty_name: string | null;
          rating_score: string | number | null;
        }>();

        const result: SlimDoc[] = await Promise.all(
          rows.map(async (r) => {
            let downloadUrl: string | null = null;
            if (r.d_thumbnail_key) {
              try {
                downloadUrl = await this.s3Service.getPresignedDownloadUrl(
                  r.d_thumbnail_key,
                  r.d_title || undefined,
                  false
                );
              } catch {
                downloadUrl = null;
              }
            }
            const fileType = r.d_file_key
              ? (r.d_file_key.split('.').pop() || '').toLowerCase() || null
              : null;

            return {
              id: r.d_id,
              title: r.d_title,
              downloadCount: Number(r.d_download_count) || 0,
              uploadDate: r.d_upload_date,
              subject: r.subject_name ? { name: r.subject_name } : null,
              faculty: r.faculty_name ? { name: r.faculty_name } : null,
              thumbnail: downloadUrl,
              score: r.rating_score != null ? Number(r.rating_score) : null,
              type: fileType,
            } as SlimDoc;
          })
        );

        return result;
      })();

      // ----- Users (image_url từ S3) -----
      const usersPromise = (async () => {
        if (!keyword) return [];

        const kw = `%${keyword}%`;
        const baseUsers = await this.userRepo
          .createQueryBuilder('u')
          .where('u.name ILIKE :kw', { kw })
          .orWhere(`split_part(u.email, '@', 1) ILIKE :kw`, { kw })
          .select(['u.id AS id', 'u.name AS name', 'u.image_key AS "imageKey"'])
          .orderBy('u.name', 'ASC')
          .getRawMany<{ id: string; name: string; imageKey: string | null }>();

        if (baseUsers.length === 0) return [];

        const ids = baseUsers.map((u) => u.id);
        const { targetCol, followerCol } = await this.resolveUserFollowerColumns();

        const followerRows = await this.userRepo.query(
          `SELECT ${qi(targetCol)} AS id, COUNT(*)::int AS "followersCount"
          FROM user_followers
          WHERE ${qi(targetCol)} = ANY($1)
          GROUP BY ${qi(targetCol)}`,
          [ids]
        );
        const followersCountMap = new Map<string, number>(
          followerRows.map((r: any) => [r.id, Number(r.followersCount) || 0])
        );

        const docRows = await this.documentRepo
          .createQueryBuilder('d')
          .leftJoin('d.uploader', 'up')
          .where('up.id IN (:...ids)', { ids })
          .andWhere('d.status = :status', { status: Status.ACTIVE })
          .select('up.id', 'id')
          .addSelect('COUNT(d.id)', 'documentsCount')
          .groupBy('up.id')
          .getRawMany<{ id: string; documentsCount: string }>();
        const documentsCountMap = new Map<string, number>(
          docRows.map((r) => [r.id, Number(r.documentsCount) || 0])
        );

        let isFollowingSet = new Set<string>();
        if (currentUserId) {
          const followedRows = await this.userRepo.query(
            `SELECT ${qi(targetCol)} AS id
            FROM user_followers
            WHERE ${qi(followerCol)} = $1 AND ${qi(targetCol)} = ANY($2)`,
            [currentUserId, ids]
          );
          isFollowingSet = new Set(followedRows.map((r: any) => r.id));
        }

        const users = await Promise.all(
          baseUsers.map(async (u) => {
            let image_url: string | null = null;
            if (u.imageKey) {
              try {
                image_url = await this.s3Service.getPresignedDownloadUrl(
                  u.imageKey,
                  u.name || undefined,
                  false
                );
              } catch {
                image_url = null;
              }
            }

            return {
              id: u.id,
              name: u.name,
              image_url,
              followersCount: followersCountMap.get(u.id) ?? 0,
              documentsCount: documentsCountMap.get(u.id) ?? 0,
              isFollowing: currentUserId ? isFollowingSet.has(u.id) : false,
            };
          })
        );

        return users;
      })();

      // ----- Subjects -----
      const subjectsPromise = (async () => {
        if (keyword) {
          const kw = `%${keyword}%`;
          const rows = await this.subjectRepo
            .createQueryBuilder('s')
            .leftJoin('s.documents', 'd')
            .where(
              new Brackets((b) => {
                b.where('s.name ILIKE :kw', { kw }).orWhere('d.title ILIKE :kw', { kw });
              })
            )
            .select([
              's.id AS id',
              's.name AS name',
              's.image_url AS image_url',
              'COUNT(CASE WHEN d.status = :activeStatus THEN d.id END) AS count',
            ])
            .setParameter('activeStatus', Status.ACTIVE)
            .groupBy('s.id')
            .addGroupBy('s.name')
            .addGroupBy('s.image_url')
            .getRawMany<{ id: string; name: string; image_url: string | null; count: string }>();

          return rows.map((r) => ({
            id: r.id,
            name: r.name,
            count: Number(r.count) || 0,
            image_url: r.image_url ?? null,
          }));
        }

        if (!keyword && subject) {
          const rows = await this.subjectRepo
            .createQueryBuilder('s')
            .leftJoin('s.documents', 'd')
            .where('s.name ILIKE :sname', { sname: `%${subject}%` })
            .select([
              's.id AS id',
              's.name AS name',
              's.image_url AS image_url',
              'COUNT(CASE WHEN d.status = :activeStatus THEN d.id END) AS count',
            ])
            .setParameter('activeStatus', Status.ACTIVE)
            .groupBy('s.id')
            .addGroupBy('s.name')
            .addGroupBy('s.image_url')
            .getRawMany<{ id: string; name: string; image_url: string | null; count: string }>();

          return rows.map((r) => ({
            id: r.id,
            name: r.name,
            count: Number(r.count) || 0,
            image_url: r.image_url ?? null,
          }));
        }

        return [];
      })();

      // ----- Faculties -----
      const facultiesPromise = (async () => {
        if (keyword) {
          const kw = `%${keyword}%`;
          const rows = await this.facultyRepo
            .createQueryBuilder('f')
            .leftJoin('f.curricula', 'fy')
            .leftJoin('fy.subject', 's')
            .leftJoin('f.documents', 'd')
            .where(
              new Brackets((b) => {
                b.where('f.name ILIKE :kw', { kw }).orWhere('s.name ILIKE :kw', { kw });
              })
            )
            .select([
              'f.id AS id',
              'f.name AS name',
              'f.image_url AS image_url',
              'COUNT(CASE WHEN d.status = :activeStatus THEN d.id END) AS count',
            ])
            .setParameter('activeStatus', Status.ACTIVE)
            .groupBy('f.id')
            .addGroupBy('f.name')
            .addGroupBy('f.image_url')
            .getRawMany<{ id: string; name: string; image_url: string | null; count: string }>();

          return rows.map((r) => ({
            id: r.id,
            name: r.name,
            count: Number(r.count) || 0,
            image_url: r.image_url ?? null,
          }));
        }

        if (!keyword && faculty) {
          const rows = await this.facultyRepo
            .createQueryBuilder('f')
            .leftJoin('f.documents', 'd')
            .where('f.name ILIKE :fname', { fname: `%${faculty}%` })
            .select([
              'f.id AS id',
              'f.name AS name',
              'f.image_url AS image_url',
              'COUNT(CASE WHEN d.status = :activeStatus THEN d.id END) AS count',
            ])
            .setParameter('activeStatus', Status.ACTIVE)
            .groupBy('f.id')
            .addGroupBy('f.name')
            .addGroupBy('f.image_url')
            .getRawMany<{ id: string; name: string; image_url: string | null; count: string }>();

          return rows.map((r) => ({
            id: r.id,
            name: r.name,
            count: Number(r.count) || 0,
            image_url: r.image_url ?? null,
          }));
        }

        return [];
      })();

      const [documents, users, subjectsArr, facultiesArr] = await Promise.all([
        docsPromise,
        usersPromise,
        subjectsPromise,
        facultiesPromise,
      ]);

      if (q?.type || q?.sort || q?.faculty || q?.subject) {
        const filtered = this.filterDocuments(documents, {
          faculty: q?.faculty,
          type: q?.type,
          sort: q?.sort as any,
        });
        return {
          documents: filtered,
          users,
          subjects: subjectsArr,
          faculties: facultiesArr,
        };
      }

      return {
        documents,
        users,
        subjects: subjectsArr,
        faculties: facultiesArr,
      };
    }
  }

  filterDocuments(
    docs: SlimDoc[],
    opts?: { faculty?: string; type?: string; sort?: 'newest' | 'oldest' | 'downloadCount' }
  ): SlimDoc[] {
    let results = Array.isArray(docs) ? docs.slice() : [];

    if (opts?.faculty) {
      const f = opts.faculty.toLowerCase();
      results = results.filter((d) => (d.faculty?.name ?? '').toLowerCase().includes(f));
    }

    if (opts?.type) {
      const raw = opts.type.toLowerCase().trim().replace(/^\./, '');
      const aliasMap: Record<string, string[]> = {
        pdf: ['pdf'],
        word: ['doc', 'docx'],
        image: ['jpg', 'jpeg', 'png', 'gif'],
        powerpoint: ['pptx'],
      };

      const allowed = aliasMap[raw] ?? [raw];
      results = results.filter((d) => allowed.includes(((d.type ?? '') as string).toLowerCase()));
    }

    if (opts?.sort === 'downloadCount') {
      results.sort((a, b) => b.downloadCount - a.downloadCount);
    } else if (opts?.sort === 'newest') {
      results.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    } else if (opts?.sort === 'oldest') {
      results.sort((a, b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime());
    }

    return results;
  }

  async suggest(keyword: string): Promise<string[]> {
    const kw = keyword.trim();
    if (kw.length < 1) return [];

    const [docs, subs, facs, users] = await Promise.all([
      this.documentRepo.find({
        select: ['id', 'title'],
        where: { title: ILike(`%${kw}%`), status: Status.ACTIVE },
        take: 5,
        order: { title: 'ASC' },
      }),
      this.subjectRepo.find({
        select: ['id', 'name'],
        where: { name: ILike(`%${kw}%`) },
        take: 5,
        order: { name: 'ASC' },
      }),
      this.facultyRepo.find({
        select: ['id', 'name'],
        where: { name: ILike(`%${kw}%`) },
        take: 5,
        order: { name: 'ASC' },
      }),
      this.userRepo.find({
        select: ['id', 'name'],
        where: { name: ILike(`%${kw}%`) },
        take: 5,
        order: { name: 'ASC' },
      }),
    ]);

    type Hit = { name: string };
    const hits: Hit[] = [
      ...docs.map((d) => ({ name: d.title })),
      ...subs.map((s) => ({ name: s.name })),
      ...facs.map((f) => ({ name: f.name })),
      ...users.map((u) => ({ name: u.name })),
    ];

    const score = (name: string) => {
      const n = (name || '').toLowerCase();
      const k = kw.toLowerCase();
      const pos = n.indexOf(k);
      const posScore = pos === -1 ? 999 : pos;
      const lenPenalty = Math.abs(n.length - k.length);
      return posScore * 1000 + lenPenalty;
    };

    hits.sort((a, b) => score(a.name) - score(b.name));

    return hits.slice(0, 5).map((h) => h.name);
  }

  async getDownloadUrl(id: string): Promise<string> {
    const document = await this.documentRepo.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    const fileKey: string = document.fileKey;
    const fileName: string = document.title || 'downloaded-file';
    const isDownload: boolean = true;
    if (!fileKey) {
      throw new NotFoundException(`Document "${id}" does not have an attached file`);
    }
    const url = await this.s3Service.getPresignedDownloadUrl(fileKey, fileName, isDownload);
    document.downloadCount++;
    this.documentRepo.save(document);
    this.logger.log(` Generated presigned URL for document: ${id}`);
    return url;
  }

  async getDocumentById(id: string): Promise<DetailsDocumentResponseDto> {
    const document: Document | null = await this.documentRepo.findOne({
      where: { id },
      relations: ['subject', 'faculties', 'uploader', 'ratings', 'images'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    const overallRating: number =
      document.ratings && document.ratings.length > 0
        ? document.ratings.reduce((sum, rating) => sum + rating.score, 0) / document.ratings.length
        : 0;

    const images: string[] = await Promise.all(
      document.images.map(
        async (image) => await this.s3Service.getPresignedDownloadUrl(image.fileKey, image.fileKey)
      )
    );
    return new DetailsDocumentResponseDto({
      id: document.id,
      title: document.title,
      description: document.description,
      fileUrl: document.fileKey
        ? await this.s3Service.getPresignedDownloadUrl(document.fileKey, document.title)
        : null,
      uploadDate: document.uploadDate,
      subject: document.subject ? document.subject.name : null,
      faculties: document.faculties ? document.faculties.map((f) => f.name) : null,
      uploader: document.uploader
        ? {
            name: document.uploader.name,
            id: document.uploader.id,
            isVerified: document.uploader.isVerified,
            createdAt: document.uploader.createdAt,
          }
        : null,
      downloadCount: document.downloadCount,
      status: document.status,
      images: images ? images : [],
      thumbnailUrl: document.thumbnailKey
        ? await this.s3Service.getPresignedDownloadUrl(document.thumbnailKey, document.title)
        : null,
      overallRating,
    });
  }

  async getDocumentsByFaculty(
    facultyId: string,
    currentUserId?: string
  ): Promise<FacultyDocumentsResponse> {
    const faculty = await this.facultyRepo.findOne({ where: { id: facultyId } });
    if (!faculty) throw new NotFoundException(`Faculty with ID "${facultyId}" not found`);

    const facultyImageUrl: string | null = faculty.imageUrl ?? null;

    let isFollowingFaculty = false;
    if (currentUserId) {
      const meFollow = await this.userRepo
        .createQueryBuilder('u')
        .leftJoin('u.subscribedFaculties', 'f')
        .where('u.id = :uid', { uid: currentUserId })
        .andWhere('f.id = :fid', { fid: facultyId })
        .select('f.id', 'fid')
        .getRawOne<{ fid: string }>();
      isFollowingFaculty = Boolean(meFollow?.fid);
    }

    const followersRow = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.subscribedFaculties', 'f')
      .where('f.id = :fid', { fid: facultyId })
      .select('COUNT(u.id)', 'cnt')
      .getRawOne<{ cnt: string }>();
    const followersCount = Number(followersRow?.cnt ?? 0);

    const fys = await this.fysRepo.find({
      where: { faculty: { id: facultyId } },
      relations: ['subject'],
    });

    type SlimDoc = {
      id: string;
      title: string;
      downloadCount: number;
      uploadDate: Date;
      subject: { name: string; id?: string } | null;
      faculty: { name: string } | null;
      thumbnail: string | null;
      score: number | null;
      type: string | null;
    };
    type Group = { subjectId: string | null; subjectName: string | null; docs: SlimDoc[] };

    const map: Record<string, Group> = {};
    for (const row of fys) {
      if (row.subject) {
        const sid = row.subject.id;
        if (!map[sid]) map[sid] = { subjectId: sid, subjectName: row.subject.name, docs: [] };
      }
    }

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoin('d.subject', 'subject')
      .leftJoin('d.faculties', 'faculty')
      .leftJoin('d.ratings', 'rating')
      .where('faculty.id = :fid', { fid: facultyId })
      .andWhere('d.status = :status', { status: Status.ACTIVE })
      .select([
        'd.id AS d_id',
        'd.title AS d_title',
        'd.description AS d_description',
        'd.file_key AS d_file_key',
        'd.download_count AS d_download_count',
        'd.upload_date AS d_upload_date',
        'd.thumbnail_key AS d_thumbnail_key',
        'subject.id AS subject_id',
        'subject.name AS subject_name',
        'faculty.name AS faculty_name',
        'AVG(rating.score) AS rating_score',
      ]);

    qb.groupBy('d.id')
      .addGroupBy('d.title')
      .addGroupBy('d.description')
      .addGroupBy('d.download_count')
      .addGroupBy('d.upload_date')
      .addGroupBy('d.thumbnail_key')
      .addGroupBy('d.file_key')
      .addGroupBy('subject.id')
      .addGroupBy('subject.name')
      .addGroupBy('faculty.name');

    const rows = await qb.getRawMany<{
      d_id: string;
      d_title: string;
      d_description: string | null;
      d_file_key: string | null;
      d_download_count: number;
      d_upload_date: Date;
      d_thumbnail_key: string | null;
      subject_id: string | null;
      subject_name: string | null;
      faculty_name: string | null;
      rating_score: string | number | null;
    }>();

    const docs: SlimDoc[] = await Promise.all(
      rows.map(async (r) => {
        let downloadUrl: string | null = null;
        if (r.d_thumbnail_key) {
          try {
            downloadUrl = await this.s3Service.getPresignedDownloadUrl(
              r.d_thumbnail_key,
              r.d_title || undefined,
              true
            );
          } catch {
            downloadUrl = null;
          }
        }
        const fileType = r.d_file_key
          ? (r.d_file_key.split('.').pop() || '').toLowerCase() || null
          : null;

        return {
          id: r.d_id,
          title: r.d_title,
          downloadCount: Number(r.d_download_count) || 0,
          uploadDate: r.d_upload_date,
          subject: r.subject_name
            ? { name: r.subject_name, id: r.subject_id as any }
            : (null as any),
          faculty: null,
          thumbnail: downloadUrl,
          score: r.rating_score != null ? Number(r.rating_score) : null,
          type: fileType,
        } as any as SlimDoc;
      })
    );

    for (const d of docs) {
      const sid = (d as any).subject?.id ?? null;
      const sname = d.subject?.name ?? null;
      if (!sid) continue;
      if (!map[sid]) map[sid] = { subjectId: sid, subjectName: sname, docs: [] };
      map[sid].docs.push(d);
    }

    const subjectIds = Object.values(map)
      .map((g) => g.subjectId)
      .filter((x): x is string => !!x);
    let followingSet = new Set<string>();
    if (currentUserId && subjectIds.length > 0) {
      const followedRows = await this.userRepo
        .createQueryBuilder('u')
        .leftJoin('u.subscribedSubjects', 's')
        .where('u.id = :uid', { uid: currentUserId })
        .andWhere('s.id IN (:...ids)', { ids: subjectIds })
        .select('s.id', 'id')
        .getRawMany<{ id: string }>();
      followingSet = new Set(followedRows.map((r) => r.id));
    }

    const subjects = Object.values(map).map((g) => ({
      id: g.subjectId,
      name: g.subjectName,
      isFollowing: g.subjectId ? followingSet.has(g.subjectId) : false,
      documents: g.docs.map((d) => ({
        id: d.id,
        title: d.title,
        downloadCount: d.downloadCount,
        uploadDate: d.uploadDate,
        thumbnail: d.thumbnail,
        score: d.score,
        type: d.type,
      })),
    }));

    return {
      name: faculty.name,
      imageUrl: facultyImageUrl,
      document_count: docs.length,
      followers_count: followersCount,
      isFollowingFaculty,
      subjects,
    };
  }

  async getDocumentsBySubject(
    subjectId: string,
    currentUserId?: string
  ): Promise<SubjectDocumentsResponse> {
    const subjectEntity = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!subjectEntity) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    const imageUrl: string | null = subjectEntity.imageUrl ?? null;

    let isFollowingSubject = false;
    if (currentUserId) {
      const meFollow = await this.userRepo
        .createQueryBuilder('u')
        .leftJoin('u.subscribedSubjects', 's')
        .where('u.id = :uid', { uid: currentUserId })
        .andWhere('s.id = :sid', { sid: subjectId })
        .select('s.id', 'sid')
        .getRawOne<{ sid: string }>();
      isFollowingSubject = Boolean(meFollow?.sid);
    }

    const followerRow = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.subscribedSubjects', 's')
      .where('s.id = :sid', { sid: subjectId })
      .select('COUNT(u.id)', 'cnt')
      .getRawOne<{ cnt: string }>();
    const followersCount = Number(followerRow?.cnt ?? 0);

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoin('d.subject', 'subject')
      .leftJoin('d.faculties', 'faculty')
      .leftJoin('d.ratings', 'rating')
      .leftJoin('d.documentType', 'dt')
      .where('subject.id = :sid', { sid: subjectId })
      .andWhere('d.status = :status', { status: Status.ACTIVE })
      .select([
        'd.id AS d_id',
        'd.title AS d_title',
        'd.description AS d_description',
        'd.file_key AS d_file_key',
        'd.download_count AS d_download_count',
        'd.upload_date AS d_upload_date',
        'd.thumbnail_key AS d_thumbnail_key',
        'subject.name AS subject_name',
        'faculty.name AS faculty_name',
        'dt.name AS type_name',
        'AVG(rating.score) AS rating_score',
      ]);

    qb.groupBy('d.id')
      .addGroupBy('d.title')
      .addGroupBy('d.description')
      .addGroupBy('d.download_count')
      .addGroupBy('d.upload_date')
      .addGroupBy('d.thumbnail_key')
      .addGroupBy('d.file_key')
      .addGroupBy('subject.name')
      .addGroupBy('faculty.name')
      .addGroupBy('dt.name');

    const rows = await qb.getRawMany<{
      d_id: string;
      d_title: string;
      d_description: string | null;
      d_file_key: string | null;
      d_download_count: number;
      d_upload_date: Date;
      d_thumbnail_key: string | null;
      subject_name: string | null;
      faculty_name: string | null;
      type_name: string | null;
      rating_score: string | number | null;
    }>();

    const docs: (SlimDoc & { __typeName?: string | null })[] = await Promise.all(
      rows.map(async (r) => {
        let downloadUrl: string | null = null;
        if (r.d_thumbnail_key) {
          try {
            downloadUrl = await this.s3Service.getPresignedDownloadUrl(
              r.d_thumbnail_key,
              r.d_title || undefined,
              true
            );
          } catch {
            downloadUrl = null;
          }
        }

        const fileType = r.d_file_key
          ? (r.d_file_key.split('.').pop() || '').toLowerCase() || null
          : null;

        return {
          id: r.d_id,
          title: r.d_title,
          downloadCount: Number(r.d_download_count) || 0,
          uploadDate: r.d_upload_date,
          subject: r.subject_name ? { name: r.subject_name } : null,
          faculty: r.faculty_name ? { name: r.faculty_name } : null,
          thumbnail: downloadUrl,
          score: r.rating_score != null ? Number(r.rating_score) : null,
          type: fileType,
          __typeName: r.type_name ?? null,
        } as SlimDoc & { __typeName?: string | null };
      })
    );

    const typeMap: Record<string, { name: string | null; documents: SlimDoc[] }> = {};
    for (const d of docs) {
      const key = (d.__typeName ?? '__no_type__').toString();
      if (!typeMap[key]) typeMap[key] = { name: d.__typeName ?? null, documents: [] };
      const { __typeName, ...rest } = d as any;
      typeMap[key].documents.push(rest as SlimDoc);
    }

    const typeList = Object.values(typeMap);

    return {
      name: subjectEntity.name,
      document_count: docs.length,
      followers_count: followersCount,
      imageUrl,
      isFollowingSubject,
      typeList,
    };
  }

  async suggestSubjectsForUser(userID: string): Promise<any[]> {
    const user = await this.usersService.findByIdWithFaculty(userID);
    const year = (user as any)?.intakeYear;

    if (!user || !year || !user.faculty?.id) {
      this.logger.warn(
        `[suggestSubjectsForUser] User ${userID} not found -> fallback random subjects`
      );
      const randomSubs = await this.pickRandomSubjects(4);
      const withUrls = randomSubs.map((s) => {
        (s as any).imageUrl = (s as any).imageUrl ?? null;
        return s;
      });
      const ids = withUrls.map((s) => s.id);
      if (ids.length === 0) return [];

      const counts = await this.subjectRepo
        .createQueryBuilder('s')
        .leftJoin('s.documents', 'd')
        .where('s.id IN (:...ids)', { ids })
        .andWhere('d.status = :status', { status: Status.ACTIVE })
        .select(['s.id AS id', 'COUNT(d.id) AS count'])
        .groupBy('s.id')
        .getRawMany<{ id: string; count: string }>();

      const countMap = counts.reduce(
        (acc, cur) => ({ ...acc, [cur.id]: Number(cur.count) || 0 }),
        {} as Record<string, number>
      );

      return withUrls.map((s) => ({
        id: s.id,
        name: s.name,
        count: countMap[s.id] || 0,
        imageUrl: (s as any).imageUrl ?? null,
      }));
    }

    const maps = await this.fysRepo.find({
      where: {
        faculty: { id: user?.faculty.id },
        year: Number(year),
      },
      relations: ['subject'],
    });

    const subjects = maps.map((m) => m.subject).filter(Boolean) as Subject[];
    let withUrls = subjects.map((s) => {
      (s as any).imageUrl = (s as any).imageUrl ?? null;
      return s;
    });

    if (withUrls.length < 4) {
      const missing = 4 - withUrls.length;
      const existingIds = withUrls.map((s) => s.id);
      const extras = await this.pickRandomSubjects(missing, existingIds);
      const extrasWithUrls = extras.map((s) => {
        (s as any).imageUrl = (s as any).imageUrl ?? null;
        return s;
      });
      withUrls = withUrls.concat(extrasWithUrls);
    }

    const ids = withUrls.map((s) => s.id);
    if (ids.length === 0) return [];

    const counts = await this.subjectRepo
      .createQueryBuilder('s')
      .leftJoin('s.documents', 'd')
      .where('s.id IN (:...ids)', { ids })
      .select(['s.id AS id', 'COUNT(d.id) AS count'])
      .groupBy('s.id')
      .getRawMany<{ id: string; count: string }>();

    const countMap = counts.reduce(
      (acc, cur) => ({ ...acc, [cur.id]: Number(cur.count) || 0 }),
      {} as Record<string, number>
    );

    return withUrls.map((s) => ({
      id: s.id,
      name: s.name,
      count: countMap[s.id] || 0,
      imageUrl: (s as any).imageUrl ?? null,
    }));
  }

  private async pickRandomSubjects(n = 4, excludeIds: string[] = []): Promise<Subject[]> {
    const qb = this.subjectRepo.createQueryBuilder('s');
    if (excludeIds.length > 0) {
      qb.where('s.id NOT IN (:...excludeIds)', { excludeIds });
    }
    return qb.orderBy('RANDOM()').take(n).getMany();
  }

  async getSuggestions(): Promise<DocumentResponseDto[]> {
    const suggestedDocuments: Document[] | null = await this.documentRepo.find({
      order: { downloadCount: 'DESC' },
      where: { status: Status.ACTIVE },
      relations: ['subject'],
      take: 10,
    });

    if (!suggestedDocuments) {
      throw new NotFoundException('No documents found for suggestions');
    }
    const documents: DocumentResponseDto[] = await Promise.all(
      suggestedDocuments.map(
        async (suggestedDocument) =>
          new DocumentResponseDto({
            id: suggestedDocument.id,
            title: suggestedDocument.title,
            thumbnailUrl: suggestedDocument.thumbnailKey
              ? await this.s3Service.getPresignedDownloadUrl(
                  suggestedDocument.thumbnailKey,
                  suggestedDocument.title || undefined,
                  false
                )
              : undefined,
            subject: suggestedDocument.subject ? suggestedDocument.subject.name : undefined,
            fileType: suggestedDocument.fileType || undefined,
            uploadDate: suggestedDocument.uploadDate,
            downloadCount: suggestedDocument.downloadCount,
          })
      )
    );
    return documents;
  }

  async getAllFacultiesSuggestions(): Promise<SuggestAllFacultiesDocumentsResponseDto[]> {
    const faculties = await this.facultyRepo.find({
      relations: ['documents'],
    });
    const suggestions: SuggestAllFacultiesDocumentsResponseDto[] = await Promise.all(
      faculties.map(async (faculty) => {
        return new SuggestAllFacultiesDocumentsResponseDto({
          facultyId: faculty.id,
          facultyName: faculty.name,
          documents: await Promise.all(
            faculty.documents
              .filter((doc) => doc.status === Status.ACTIVE)
              .map(async (doc) => {
                return new DocumentResponseDto({
                  id: doc.id,
                  title: doc.title,
                  uploadDate: doc.uploadDate,
                  fileType: doc.fileType || undefined,
                  thumbnailUrl: doc.thumbnailKey
                    ? await this.s3Service.getPresignedDownloadUrl(
                        doc.thumbnailKey,
                        doc.title || undefined,
                        false
                      )
                    : undefined,
                  downloadCount: doc.downloadCount,
                });
              })
          ),
        });
      })
    );

    return suggestions;
  }

  async uploadDocument(
    file: Express.Multer.File,
    images: Express.Multer.File[],
    userId: string,
    thumbnailFile?: Express.Multer.File,
    facultyIds?: string[],
    subjectId?: string,
    documentTypeId?: string,
    description?: string,
    fileType: string = ''
  ): Promise<DocumentResponseDto> {
    if (!file) throw new BadRequestException('Thiếu file tải lên.');

    // 1️ Kiểm tra user
    const uploaderUser = await this.userRepo.findOneBy({ id: userId });
    if (!uploaderUser) {
      throw new NotFoundException(`Uploader with ID "${userId}" not found`);
    }

    // 2️ Upload file chính lên S3
    const fileKey = await this.s3Service.uploadFile(file, 'documents');
    this.logger.debug(`Uploaded fileKey = ${fileKey}`);

    // 3️ Upload thumbnail nếu có
    let thumbnailKey: string | null = null;
    if (thumbnailFile) {
      thumbnailKey = await this.s3Service.uploadFile(thumbnailFile, 'thumbnails');
    }
    // 4️ Tạo Document entity

    const faculties = facultyIds ? await this.facultyRepo.findBy({ id: In(facultyIds) }) : [];
    const subject = subjectId ? await this.subjectRepo.findOneBy({ id: subjectId }) : null;
    const documentType = documentTypeId
      ? await this.documentTypeRepo.findOneBy({ id: documentTypeId })
      : null;
    const doc = this.documentRepo.create({
      title: file.originalname,
      description: description || null,
      fileKey,
      thumbnailKey,
      uploader: uploaderUser,
      faculties: facultyIds ? faculties : [],
      subject: subjectId ? subject : null,
      documentType: documentType,
      status: 'pending',
      fileType: fileType || (file.originalname.split('.').pop() || '').toLowerCase(),
    } as DeepPartial<Document>);
    const savedDoc = await this.documentRepo.save(doc);

    //  Upload images liên quan (nếu có)
    if (images?.length) {
      const imageEntities: Image[] = [];

      for (const img of images) {
        const imgKey = await this.s3Service.uploadFile(img, 'images');
        imageEntities.push(this.imageRepo.create({ fileKey: imgKey, document: savedDoc }));
      }

      await this.imageRepo.save(imageEntities);
    }
    // 6 Gửi thông báo (nếu có module Notification)
    const documentId: string = savedDoc.id;
    const docName: string = savedDoc.title;
    this.notificationsService.sendNewDocumentNotification(
      documentId,
      facultyIds ? facultyIds : undefined,
      subjectId,
      docName
    );
    // 7️ Tạo link download tạm thời
    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(fileKey);

    return new DocumentResponseDto({
      id: savedDoc.id,
      title: savedDoc.title,
      description: savedDoc.description,
      thumbnailUrl: savedDoc.thumbnailKey
        ? await this.s3Service.getPresignedDownloadUrl(
            savedDoc.thumbnailKey!,
            savedDoc.title || undefined,
            false
          )
        : undefined,
      uploadDate: savedDoc.uploadDate,
      downloadUrl,
    });
  }

  async getAllFacultiesAndSubjectsAndDocumentTypes(): Promise<AllFacultiesAndSubjectsAndDocumentTypesDto> {
    const faculties = await this.facultyRepo.find();
    const subjects = await this.subjectRepo.find();
    const documentTypes = await this.documentTypeRepo.find();
    return new AllFacultiesAndSubjectsAndDocumentTypesDto({
      faculties: faculties.map((f) => ({ id: f.id, name: f.name })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
      documentTypes: documentTypes.map((dt) => ({ id: dt.id, name: dt.name })),
    });
  }

  async updateDocumentStatus(id: string, status: string): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id },
      relations: ['faculties', 'subject'],
    });

    console.log('document found:', document);
    if (!document) throw new NotFoundException('Không tìm thấy tài liệu');

    if (document.status === Status.ACTIVE)
      throw new BadRequestException('Tài liệu đã được duyệt trước đó');
    document.status = Status.ACTIVE;
    if (document.faculties || document.subject) {
      await this.notificationsService.sendNewDocumentNotification(
        document.id,
        document.faculties ? document.faculties.map((faculty) => faculty.id) : [],
        document.subject ? document.subject.id : undefined,
        document.title
      );
    }
    console.log('Document status updated to ACTIVE');
    return await this.documentRepo.save(document);
  }

  async getPendingDocuments(
    page: number,
    limit: number,
    fullTextSearch?: string
  ): Promise<{ data: DocumentResponseDto[]; total: number; page: number; totalPages: number }> {
    const queryBuilder = this.documentRepo
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.uploader', 'uploader')
      .leftJoinAndSelect('document.faculties', 'faculties')
      .leftJoinAndSelect('document.subject', 'subject')
      .where('document.status = :status', { status: Status.PENDING });

    // Thêm full-text search nếu có keyword
    if (fullTextSearch && fullTextSearch.trim()) {
      const searchTerm = `%${fullTextSearch.trim()}%`;
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where('document.title ILIKE :searchTerm', { searchTerm })
            .orWhere('document.description ILIKE :searchTerm', { searchTerm })
            .orWhere('subject.name ILIKE :searchTerm', { searchTerm })
            .orWhere('faculties.name ILIKE :searchTerm', { searchTerm })
            .orWhere('uploader.name ILIKE :searchTerm', { searchTerm });
        })
      );
    }

    const [data, total] = await queryBuilder
      .orderBy('document.uploadDate', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();

    const dtoData = await Promise.all(
      data.map(
        async (doc) =>
          new DocumentResponseDto({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            thumbnailUrl: doc.thumbnailKey
              ? await this.s3Service.getPresignedDownloadUrl(
                  doc.thumbnailKey!,
                  doc.title || undefined,
                  false
                )
              : undefined,
            uploadDate: doc.uploadDate,
            downloadUrl: doc.fileKey
              ? await this.s3Service.getPresignedDownloadUrl(
                  doc.fileKey!,
                  doc.title || undefined,
                  false
                )
              : undefined,
            uploader: doc.uploader
              ? {
                  id: doc.uploader.id,
                  name: doc.uploader.name,
                  isVerified: doc.uploader.isVerified,
                  createdAt: doc.uploader.createdAt,
                }
              : undefined,
            faculties: doc.faculties ? doc.faculties.map((f) => f.name) : undefined,
            subject: doc.subject ? doc.subject.name : undefined,
          })
      )
    );

    return {
      data: dtoData,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDocumentsByUserId(
    userId: string,
    limit: number,
    page: number
  ): Promise<DocumentResponseDto[]> {
    const documents = await this.documentRepo.find({
      where: { uploader: { id: userId }, status: Status.ACTIVE },
      relations: ['faculties', 'subject'],
      take: limit,
      skip: limit * (page - 1),
    });

    return Promise.all(
      documents.map(
        async (doc) =>
          new DocumentResponseDto({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            thumbnailUrl: doc.thumbnailKey
              ? await this.s3Service.getPresignedDownloadUrl(
                  doc.thumbnailKey!,
                  doc.title || undefined,
                  false
                )
              : undefined,
            uploadDate: doc.uploadDate,
            downloadUrl: doc.fileKey
              ? await this.s3Service.getPresignedDownloadUrl(
                  doc.fileKey!,
                  doc.title || undefined,
                  false
                )
              : undefined,
          })
      )
    );
  }

  async createSubject(
    name: string,
    description: string,
    image: Express.Multer.File
  ): Promise<Subject> {
    const existingSubject = await this.subjectRepo.findOneBy({ name });
    if (existingSubject) {
      throw new BadRequestException(`Subject with name "${name}" already exists`);
    }

    const imageKey = image ? await this.s3Service.uploadFile(image, 'subject-images') : undefined;
    const newSubject = await this.subjectRepo.create({
      name,
      description,
      imageKey,
    });

    return this.subjectRepo.save(newSubject);
  }
}
