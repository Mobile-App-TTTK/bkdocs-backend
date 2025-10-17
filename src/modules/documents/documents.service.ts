import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { S3Service } from '@modules/s3/s3.service';
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
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(Image)
    private readonly imageRepo: Repository<Image>,
    private readonly s3Service: S3Service
  ) {}

  async search(q: SearchDocumentsDto): Promise<(Document & { rank?: number })[]> {
    console.log('Repo tablePath:', this.documentRepo.metadata.tablePath);

    const qb = this.documentRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.subject', 'subject')
      .leftJoinAndSelect('d.faculty', 'faculty');

    const orPredicates: string[] = [];
    const params: Record<string, any> = {};

    if (q.faculty && q.faculty.trim()) {
      params.facultyName = `%${q.faculty.trim()}%`;
      orPredicates.push('LOWER(faculty.name) LIKE LOWER(:facultyName)');
    }

    if (q.subject && q.subject.trim()) {
      params.subjectName = `%${q.subject.trim()}%`;
      orPredicates.push('LOWER(subject.name) = LOWER(:subjectName)');
    }

    if (q.keyword && q.keyword.trim()) {
      params.kw = `%${q.keyword.trim()}%`;
      orPredicates.push(
        '(LOWER(d.title) LIKE LOWER(:kw) OR LOWER(d.description) LIKE LOWER(:kw) OR LOWER(d.file_key) LIKE LOWER(:kw))'
      );
    }

    if (orPredicates.length > 0) {
      qb.where(orPredicates.shift()!, params);
      for (const p of orPredicates) qb.orWhere(p, params);
    }

    return qb.getMany();
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
    this.logger.log('🧱 Tạo Document entity trong DB...');
    const doc = this.documentRepo.create({
      title: file.originalname,
      description: description || null,
      fileKey,
      thumbnailKey,
      uploader: uploaderUser,
      faculty: facultyId ? await this.facultyRepo.findOneBy({ id: facultyId }) : null,
      subject: subjectId ? await this.subjectRepo.findOneBy({ id: subjectId }) : null,
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
    // if (facultyId) await this.notificationService.notifyFacultySubscribers(facultyId, savedDoc);
    // if (subjectId) await this.notificationService.notifySubjectSubscribers(subjectId, savedDoc);

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
}
