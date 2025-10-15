import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { S3Service } from '@modules/s3/s3.service';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly s3Service: S3Service,
  ) {}

async getDownloadUrl(id: string): Promise<string> {
      const document = await this.documentRepo.findOne({ where: { id } });

      if (!document) {
        throw new NotFoundException(`Document with ID "${id}" not found`);
      }

      const fileKey = document.fileKey;
      if (!fileKey) {
        throw new NotFoundException(`Document "${id}" does not have an attached file`);
      }

      const url = await this.s3Service.getPresignedDownloadUrl(fileKey);

      this.logger.log(` Generated presigned URL for document: ${id}`);
      return url;
  }

  async getDocumentById(id: string): Promise<DetailsDocumentResponseDto> {
    // join images table to get all images of the documen
    // get name of subject, faculty and uploader (user)
    // return document with all images, subject, faculty and uploader info
    // overall rating wwil be calculated
    // return image wwith full URL in images just save the key => (presigned URL) on s3
    const document : Document | null = await this.documentRepo.findOne({
      where: { id },
      relations: ['subject', 'faculty', 'uploader', 'ratings', 'images'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    const overallRating : number = document.ratings && document.ratings.length > 0
      ? document.ratings.reduce((sum, rating) => sum + rating.score, 0) / document.ratings.length
      : 0;
    const images : string[] = await Promise.all(document.images.map(async image => await this.s3Service.getPresignedDownloadUrl(image.fileKey)));
    return new DetailsDocumentResponseDto(
      { id: document.id,
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
        },
    );
  }

}
