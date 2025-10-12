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

}
