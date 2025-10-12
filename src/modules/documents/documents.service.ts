import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly bucket: string;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @Inject('MINIO_CLIENT')
    private readonly minioClient: Client,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'documents');
  }

  async getDownloadUrl(documentId: string): Promise<string> {
    const document = await this.documentRepo.findOne({ where: { id: documentId } });

    if (!document) {
      throw new NotFoundException('Tài liệu không tồn tại');
    }
      const presignedUrl = await this.minioClient.presignedGetObject(
        this.bucket,
        document.fileKey,
        60 * 5, // 5 phút
      );

      if (!presignedUrl) {
        throw new InternalServerErrorException('Không thể tạo URL tải xuống');
      }
      this.logger.log(`Generated presigned URL for document ${document.id}`);
      return presignedUrl;
  }
}
