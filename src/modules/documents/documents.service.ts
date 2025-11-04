import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ILike, Repository, DeepPartial, In } from 'typeorm';

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
  followers_count: number
  subjects: SubjectGroup[];
};

type SubjectDocumentsResponse = {
  name: string; 
  isFollowingSubject: boolean;  
  document_count: number; 
  followers_count: number; 
  imageUrl: string | null; 
  types: Array<{
    name: string | null; 
    documents: SlimDoc[];
  }>;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

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
    private readonly notificationsService: NotificationsService
  ) {}

  async search(q: SearchDocumentsDto, currentUserId?: string): Promise<any> {
    const faculty = q.faculty?.trim();
    const subject = q.subject?.trim();
    const keyword = q.keyword?.trim();
    const searchFor = q.searchFor ?? 'all';

    if (q.searchFor === 'faculty' && keyword) {
      const kw = `%${keyword}%`;
      const rows = await this.facultyRepo
        .createQueryBuilder('f')
        .leftJoin('f.curricula', 'fy')
        .leftJoin('fy.subject', 's')
        .leftJoin('f.documents', 'd')
        .where('f.name ILIKE :kw', { kw })
        .orWhere('s.name ILIKE :kw', { kw })
        .select(['f.name AS name', 'COUNT(d.id) AS count'])
        .groupBy('f.id')
        .addGroupBy('f.name')
        .getRawMany<{ name: string; count: string }>();

      return rows.map((r) => ({ name: r.name, count: Number(r.count) || 0 }));
    }

    if (searchFor === 'subject' && keyword) {
      const kw = `%${keyword}%`;
      const rows = await this.subjectRepo
        .createQueryBuilder('s')
        .leftJoin('s.documents', 'd')
        .where('s.name ILIKE :kw', { kw })
        .orWhere('d.title ILIKE :kw', { kw })
        .select(['s.name AS name', 'COUNT(d.id) AS count'])
        .groupBy('s.id')
        .addGroupBy('s.name')
        .getRawMany<{ name: string; count: string }>();

      return rows.map((r) => ({ name: r.name, count: Number(r.count) || 0 }));
    }

    if (searchFor === 'user' && keyword) {
      const kw = `%${keyword}%`;

      const baseUsers = await this.userRepo
        .createQueryBuilder('u')
        .where('u.name ILIKE :kw', { kw })
        .orWhere('u.email ILIKE :kw', { kw })
        .select(['u.id AS id', 'u.name AS name'])
        .orderBy('u.name', 'ASC')
        .getRawMany<{ id: string; name: string }>();

      if (baseUsers.length === 0) return [];

      const ids = baseUsers.map(u => u.id);

      const followerRows = await this.userRepo
        .createQueryBuilder('u')
        .leftJoin('u.followers', 'f')
        .where('u.id IN (:...ids)', { ids })
        .select('u.id', 'id')
        .addSelect('COUNT(f.id)', 'followersCount')
        .groupBy('u.id')
        .getRawMany<{ id: string; followersCount: string }>();

      const followersCountMap = new Map<string, number>(
        followerRows.map(r => [r.id, Number(r.followersCount) || 0])
      );

      const docRows = await this.documentRepo
        .createQueryBuilder('d')
        .leftJoin('d.uploader', 'uploader')
        .where('uploader.id IN (:...ids)', { ids })
        .select('uploader.id', 'id')
        .addSelect('COUNT(d.id)', 'documentsCount')
        .groupBy('uploader.id')
        .getRawMany<{ id: string; documentsCount: string }>();

      const documentsCountMap = new Map<string, number>(
        docRows.map(r => [r.id, Number(r.documentsCount) || 0])
      );

      let isFollowingSet = new Set<string>();
      if (currentUserId) {
        const followedRows = await this.userRepo
          .createQueryBuilder('u')
          .leftJoin('u.followers', 'me', 'me.id = :me', { me: currentUserId })
          .where('u.id IN (:...ids)', { ids })
          .select('u.id', 'id')
          .addSelect('COUNT(me.id)', 'meCount')
          .groupBy('u.id')
          .getRawMany<{ id: string; meCount: string }>();

        isFollowingSet = new Set(
          followedRows.filter(r => Number(r.meCount) > 0).map(r => r.id)
        );
      }

      return baseUsers.map(u => ({
        id: u.id,
        name: u.name,
        followersCount: followersCountMap.get(u.id) ?? 0,
        documentsCount: documentsCountMap.get(u.id) ?? 0,
        isFollowing: currentUserId ? isFollowingSet.has(u.id) : false,
      }));
    }

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
        }),
        { kw: `%${keyword}%` }
      );
    }

    qb.groupBy('d.id')
      .addGroupBy('d.title')
      .addGroupBy('d.description')
      .addGroupBy('d.download_count')
      .addGroupBy('d.upload_date')
      .addGroupBy('d.thumbnail_key')
      .addGroupBy('d.file_key')
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
        };
      })
    );

    let users: string[] = [];
    if (keyword) {
      const userRows = await this.userRepo
        .createQueryBuilder('u')
        .where('u.name ILIKE :kw', { kw: `%${keyword}%` })
        .select('u.name', 'name')
        .getRawMany<{ name: string }>();
      users = userRows.map((u) => u.name);
    }

    if (!keyword && faculty) {
      const facRows = await this.facultyRepo
        .createQueryBuilder('f')
        .leftJoin('f.documents', 'd')
        .where('f.name ILIKE :fname', { fname: `%${faculty}%` })
        .select(['f.name AS name', 'COUNT(d.id) AS count'])
        .groupBy('f.id')
        .addGroupBy('f.name')
        .getRawMany<{ name: string; count: string }>();

      const faculties = facRows.map((r) => ({
        name: r.name,
        count: Number(r.count) || 0,
        documents: result
          .filter(
            (d) => ((d.faculty?.name ?? '') || '').toLowerCase() === (r.name || '').toLowerCase()
          )
          .map((d) => ({ ...d, faculty: null })),
      }));

      return { faculties };
    }

    if (!keyword && subject) {
      const subRows = await this.subjectRepo
        .createQueryBuilder('s')
        .leftJoin('s.documents', 'd')
        .where('s.name ILIKE :sname', { sname: `%${subject}%` })
        .select(['s.name AS name', 'COUNT(d.id) AS count'])
        .groupBy('s.id')
        .addGroupBy('s.name')
        .getRawMany<{ name: string; count: string }>();

      const subjects = subRows.map((r) => ({
        name: r.name,
        count: Number(r.count) || 0,
        documents: result
          .filter(
            (d) => ((d.subject?.name ?? '') || '').toLowerCase() === (r.name || '').toLowerCase()
          )
          .map((d) => ({ ...d, subject: null })),
      }));

      return { subjects };
    }

    const onlyKeyword = Boolean(keyword) && !faculty && !subject && !q?.type && !q?.sort;

    if (q?.type || q?.sort || q?.faculty || q?.subject) {
      const filtered = this.filterDocuments(result, {
        faculty: q?.faculty,
        type: q?.type,
        sort: q?.sort as any,
      });
      return onlyKeyword ? { documents: filtered, users } : filtered;
    }

    return onlyKeyword ? { documents: result, users } : result;
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
        where: { title: ILike(`%${kw}%`) },
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
      ...docs.map(d => ({ name: d.title })),
      ...subs.map(s => ({ name: s.name })),
      ...facs.map(f => ({ name: f.name })),
      ...users.map(u => ({ name: u.name })),
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

  async getDocumentsByFaculty(facultyId: string, currentUserId?: string) : Promise<FacultyDocumentsResponse> {
    const faculty = await this.facultyRepo.findOne({ where: { id: facultyId } });
    if (!faculty) {
      throw new NotFoundException(`Faculty with ID "${facultyId}" not found`);
    }

    let facultyImageUrl: string | null = null;
    if (faculty.imageKey) {
      facultyImageUrl = await this.s3Service.getPresignedDownloadUrl(
        faculty.imageKey,
        faculty.name || 'faculty-image',
        false
      );
    }

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

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoin('d.subject', 'subject')
      .leftJoin('d.faculties', 'faculty')
      .leftJoin('d.ratings', 'rating')
      .where('faculty.id = :fid', { fid: facultyId })
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
          subject: r.subject_name ? { name: r.subject_name, id: r.subject_id as any } : null as any,
          faculty: null,
          thumbnail: downloadUrl,
          score: r.rating_score != null ? Number(r.rating_score) : null,
          type: fileType,
        } as any as SlimDoc;
      })
    );

    type Group = { subjectId: string | null; subjectName: string | null; docs: SlimDoc[] };
    const map: Record<string, Group> = {};

    for (const d of docs) {
      const sid = (d as any).subject?.id ?? null;
      const sname = d.subject?.name ?? null;
      const key = sid ?? '__no_subject__';
      if (!map[key]) map[key] = { subjectId: sid, subjectName: sname, docs: [] };
      map[key].docs.push(d);
    }

    const subjectIds = Object.values(map)
      .map(g => g.subjectId)
      .filter((x): x is string => typeof x === 'string');

    let followingSet = new Set<string>();
    if (currentUserId && subjectIds.length > 0) {
      const followedRows = await this.userRepo
        .createQueryBuilder('u')
        .leftJoin('u.subscribedSubjects', 's')
        .where('u.id = :uid', { uid: currentUserId })
        .andWhere('s.id IN (:...ids)', { ids: subjectIds })
        .select('s.id', 'id')
        .getRawMany<{ id: string }>();

      followingSet = new Set(followedRows.map(r => r.id));
    }

    const subjects = Object.values(map).map((g) => ({
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

  async getDocumentsBySubject(subjectId: string, currentUserId?: string) : Promise<SubjectDocumentsResponse> {
    const subjectEntity = await this.subjectRepo.findOne({ where: { id: subjectId } });
    if (!subjectEntity) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    let imageUrl: string | null = null;
    if (subjectEntity.imageKey) {
      imageUrl = await this.s3Service.getPresignedDownloadUrl(
        subjectEntity.imageKey,
        subjectEntity.name || 'subject-image',
        true
      );
    }

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

        const fileType =
          r.d_file_key ? (r.d_file_key.split('.').pop() || '').toLowerCase() || null : null;

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

    const types = Object.values(typeMap);

    return {
      name: subjectEntity.name,
      document_count: docs.length,
      followers_count: followersCount,
      imageUrl,
      isFollowingSubject, 
      types,
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
      const withUrls = await this.attachSubjectUrls(randomSubs);
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
        downloadUrl: (s as any).downloadUrl ?? null,
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
    const withUrls = await this.attachSubjectUrls(subjects);
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
      downloadUrl: (s as any).downloadUrl ?? null,
    }));
  }

  private async pickRandomSubjects(n = 4): Promise<Subject[]> {
    return this.subjectRepo.createQueryBuilder('s').orderBy('RANDOM()').take(n).getMany();
  }

  private async attachSubjectUrls(
    subjects: Subject[],
    opts?: { download?: boolean; expiresInSeconds?: number }
  ): Promise<Subject[]> {
    const download = opts?.download ?? false;
    const expiresInSeconds = opts?.expiresInSeconds ?? 3600;

    const withUrls = await Promise.all(
      subjects.map(async (s) => {
        let url: string | null = null;
        if ((s as any).fileKey) {
          url = await this.s3Service.getPresignedDownloadUrl(
            (s as any).fileKey,
            s.name,
            download,
            expiresInSeconds
          );
        }

        (s as any).downloadUrl = url;
        return s;
      })
    );

    return withUrls;
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
      where: { uploader: { id: userId } },
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

    const imageKey = image ? await this.s3Service.uploadFile(image, 'subject-images') : null;
    const newSubject = await this.subjectRepo.create({
      name,
      description,
      imageKey,
    });

    return this.subjectRepo.save(newSubject);
  }
}
