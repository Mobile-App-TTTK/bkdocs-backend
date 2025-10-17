import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { S3Service } from '@modules/s3/s3.service';
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
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
}
