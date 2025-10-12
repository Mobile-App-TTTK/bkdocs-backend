import { Injectable, Inject, Logger, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    @Inject('MINIO_CLIENT')
    private readonly minioClient: Client,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME', 'bkdocs');
    this.region = this.configService.get<string>('MINIO_REGION', 'us-east-1');
  }

  /** 🔹 Khi app khởi động, đảm bảo bucket tồn tại */
  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, this.region);
        this.logger.log(`✅ Created bucket: ${this.bucketName}`);
      } else {
        this.logger.log(`📦 Bucket already exists: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to ensure bucket "${this.bucketName}": ${error.message}`);
    }
  }

  /** 📥 Trả về URL presigned (GET) để tải file trực tiếp từ MinIO */
  async getPresignedDownloadUrl(fileName: string, expiresInSeconds = 3600): Promise<string> {
      const url = await this.minioClient.presignedGetObject(this.bucketName, fileName, expiresInSeconds);

      // Thay host nội bộ bằng host public (nếu có)
      const internalHost = this.configService.get<string>('MINIO_INTERNAL_ENDPOINT', 'minio');
      const publicHost = this.configService.get<string>('MINIO_PUBLIC_ENDPOINT', internalHost);
      const publicPort = this.configService.get<string>('MINIO_PUBLIC_PORT', '9000');

      const finalUrl = url.replace(internalHost, `${publicHost}:${publicPort}`);

      this.logger.log(`Generated presigned URL for: ${fileName}`);
      return finalUrl;
  }
}
