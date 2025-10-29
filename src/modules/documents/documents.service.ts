import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Inject,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ILike, Repository, DeepPartial } from 'typeorm';

import { Document } from './entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { S3Service } from '@modules/s3/s3.service';
import { FacultyYearSubject } from './entities/faculty-year-subject.entity';
import { UsersService } from '@modules/users/user.service';

import {
  SuggestDocumentResponseDto,
  SuggestDocumentsResponseDto,
} from './dtos/responses/suggestDocument.response.dto';
import { User } from '@modules/users/entities/user.entity';
import { Faculty } from '@modules/documents/entities/falcuty.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { AllFacultiesAndSubjectsDto } from './dtos/responses/allFalcutiesAndSubjects.response.dto';
import { DocumentResponseDto } from './dtos/responses/document.response.dto';
import { Image } from './entities/image.entity';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType } from '@common/enums/notification-type.enum';
import { CreateNotificationDto } from '@modules/notifications/dtos/create-notification.dto';
import { Status } from '@common/enums/status.enum';

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

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(FacultyYearSubject) private readonly fysRepo: Repository<FacultyYearSubject>,
    private readonly usersService: UsersService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Image)
    private readonly imageRepo: Repository<Image>,
    private readonly s3Service: S3Service,
    private readonly NotificationsService: NotificationsService
  ) {}

  async search(q: SearchDocumentsDto): Promise<any> {
    const faculty = q.faculty?.trim();
    const subject = q.subject?.trim();
    const keyword = q.keyword?.trim();
    const searchFor = q.searchFor ?? 'documents';

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

      return rows.map(r => ({ name: r.name, count: Number(r.count) || 0 }));
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

        return rows.map(r => ({ name: r.name, count: Number(r.count) || 0 }));
      }

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoin('d.subject', 'subject')
      .leftJoin('d.faculty', 'faculty')
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
      qb.andWhere(new Brackets(b => {
        b.where('d.title ILIKE :kw')
        .orWhere('d.description ILIKE :kw')
        .orWhere('d.thumbnailKey ILIKE :kw')
        .orWhere('d.fileKey ILIKE :kw');
      }), { kw: `%${keyword}%` });
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
        };
      })
    );

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
          .filter((d) => ((d.faculty?.name ?? '') || '').toLowerCase() === (r.name || '').toLowerCase())
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
          .filter((d) => ((d.subject?.name ?? '') || '').toLowerCase() === (r.name || '').toLowerCase())
          .map((d) => ({ ...d, subject: null })),
      }));

      return { subjects };
    }

    if (q?.type || q?.sort || q?.faculty) {
      return this.filterDocuments(result, { faculty: q?.faculty, type: q?.type, sort: q?.sort as any });
    }

    return result;
  }

  filterDocuments(docs: SlimDoc[], opts?: { faculty?: string; type?: string; sort?: 'asc' | 'desc' }): SlimDoc[] {
    let results = Array.isArray(docs) ? docs.slice() : [];

    if (opts?.faculty) {
      const f = opts.faculty.toLowerCase();
      results = results.filter(d => (d.faculty?.name ?? '').toLowerCase().includes(f));
    }

    if (opts?.type) {
      const t = opts.type.toLowerCase();
      results = results.filter(d => (d.type ?? '').toLowerCase() === t);
    }

    if (opts?.sort) {
      results.sort((a, b) => {
        const da = new Date(a.uploadDate).getTime();
        const db = new Date(b.uploadDate).getTime();
        return opts.sort === 'asc' ? da - db : db - da;
      });
    }

    return results;
  }

  async suggest(keyword: string): Promise<string[]> {
    const kw = keyword.trim();
    if (kw.length < 1) return [];

    const [docs, subs, facs] = await Promise.all([
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
    ]);

    type Hit = { name: string };
    const hits: Hit[] = [
      ...docs.map(d => ({ name: d.title })),
      ...subs.map(s => ({ name: s.name })),
      ...facs.map(f => ({ name: f.name })),
    ];

    const score = (name: string) => {
      const n = name.toLowerCase();
      const k = kw.toLowerCase();
      const pos = n.indexOf(k);
      const posScore = pos === -1 ? 999 : pos;
      const lenPenalty = Math.abs(n.length - k.length);
      return posScore * 1000 + lenPenalty;
    };

    hits.sort((a, b) => score(a.name) - score(b.name));

    return hits.slice(0, 5).map(h => h.name);
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
      relations: ['subject', 'faculty', 'uploader', 'ratings', 'images'],
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
      fileKey: document.fileKey,
      uploadDate: document.uploadDate,
      subject: document.subject ? document.subject.name : null,
      faculty: document.faculty ? document.faculty.name : null,
      uploader: document.uploader ? document.uploader.name : null,
      downloadCount: document.downloadCount,
      status: document.status,
      images: images ? images : [],
      thumbnailKey: document.thumbnailKey,
      overallRating,
    });
  }

  async suggestSubjectsForUser(userID: string): Promise<Subject[]> {
    const user = await this.usersService.findByIdWithFaculty(userID);
    const year = (user as any)?.yearOfStudy ?? (user as any)?.year_of_study;

    if (!user || !year || !user.faculty?.id) {
      this.logger.warn(`[suggestSubjectsForUser] User ${userID} not found -> fallback random subjects`);
      const randomSubs = await this.pickRandomSubjects(4);
    return this.attachSubjectUrls(randomSubs);
    }

    const maps = await this.fysRepo.find({
      where: {
        faculty: { id: user.faculty.id },
        year: Number(year),
      },
      relations: ['subject'],
    });

    const subjects = maps.map((m) => m.subject).filter(Boolean) as Subject[];
    return this.attachSubjectUrls(subjects);
  }

  private async pickRandomSubjects(n = 4): Promise<Subject[]> {
    return this.subjectRepo
      .createQueryBuilder('s')
      .orderBy('RANDOM()')
      .take(n)
      .getMany();
  }

  private async attachSubjectUrls(subjects: Subject[], opts?: { download?: boolean; expiresInSeconds?: number }) : Promise<Subject[]> {
    const download = opts?.download ?? false;
    const expiresInSeconds = opts?.expiresInSeconds ?? 3600;

    const withUrls = await Promise.all(subjects.map(async (s) => {
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
    }));

    return withUrls;
  }
  
  async getSuggestions(): Promise<SuggestDocumentsResponseDto> {
    // limited to top 3 suggestion for simplicity

    const suggestedDocuments: Document[] | null = await this.documentRepo.find({
      order: { downloadCount: 'DESC' },
      take: 3,
    });

    if (!suggestedDocuments) {
      throw new NotFoundException('No documents found for suggestions');
    }
    const documents: SuggestDocumentResponseDto[] = suggestedDocuments.map(
      (suggestedDocument) =>
        new SuggestDocumentResponseDto({
          id: suggestedDocument.id,
          title: suggestedDocument.title,
          uploadDate: suggestedDocument.uploadDate,
          downloadCount: suggestedDocument.downloadCount,
        })
    );
    return new SuggestDocumentsResponseDto({
      documents,
    });
  }

  async getUserSuggestions(userId: string): Promise<SuggestDocumentsResponseDto> {
    const user: User | null = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['faculty'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    // Placeholder logic for user-specific suggestions
    const suggestedDocuments: Document[] | null = await this.documentRepo.find({
      order: { downloadCount: 'DESC' },
      where: { faculty: user.faculty },
      take: 10,
    });

    const documents: SuggestDocumentResponseDto[] = suggestedDocuments.map(
      (suggestedDocument) =>
        new SuggestDocumentResponseDto({
          id: suggestedDocument.id,
          title: suggestedDocument.title,
          uploadDate: suggestedDocument.uploadDate,
          downloadCount: suggestedDocument.downloadCount,
        })
    );
    if (!suggestedDocuments) {
      throw new NotFoundException('No documents found for suggestions');
    }

    return new SuggestDocumentsResponseDto({
      documents,
    });
  }

  async uploadDocument(
    file: Express.Multer.File,
    images: Express.Multer.File[],
    userId: string,
    thumbnailFile?: Express.Multer.File,
    facultyId?: string,
    subjectId?: string,
    description?: string
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
    const falcuty = facultyId ? await this.facultyRepo.findOneBy({ id: facultyId }) : null;
    const subject = subjectId ? await this.subjectRepo.findOneBy({ id: subjectId }) : null;
    const doc = this.documentRepo.create({
      title: file.originalname,
      description: description || null,
      fileKey,
      thumbnailKey,
      uploader: uploaderUser,
      faculty: facultyId ? falcuty : null,
      subject: subjectId ? subject : null,
      status: 'pending',
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
    this.NotificationsService.sendNewDocumentNotification(
      documentId,
      facultyId,
      subjectId,
      docName
    );
    // 7️ Tạo link download tạm thời
    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(fileKey);

    return new DocumentResponseDto({
      id: savedDoc.id,
      title: savedDoc.title,
      description: savedDoc.description,
      fileKey: savedDoc.fileKey,
      thumbnailKey: savedDoc.thumbnailKey,
      uploadDate: savedDoc.uploadDate,
      downloadUrl,
    });
  }

  async getAllFacultiesAndSubjects(): Promise<AllFacultiesAndSubjectsDto> {
    const faculties = await this.facultyRepo.find();
    const subjects = await this.subjectRepo.find();
    return new AllFacultiesAndSubjectsDto({
      faculties: faculties.map((f) => ({ id: f.id, name: f.name })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
    });
  }

  async updateDocumentStatus(id: string, status: string): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id },
      relations: ['faculty', 'subject'],
    });
    if (!document) throw new NotFoundException('Không tìm thấy tài liệu');

    if (document.status === Status.ACTIVE)
      throw new BadRequestException('Tài liệu đã được duyệt trước đó');

    document.status = Status.ACTIVE;
    if (document.faculty || document.subject) {
      await this.NotificationsService.sendNewDocumentNotification(
        document.id,
        document.faculty.id,
        document.subject.id,
        document.title
      );
    }

    return await this.documentRepo.save(document);
  }

  async getPendingDocuments(
    page: number,
    limit: number
  ): Promise<{ data: Document[]; total: number; page: number; totalPages: number }> {
    const [data, total] = await this.documentRepo.findAndCount({
      where: { status: Status.PENDING },
      order: { uploadDate: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
      relations: ['uploader', 'faculty', 'subject'],
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
