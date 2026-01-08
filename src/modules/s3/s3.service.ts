import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;

  constructor(
    @Inject('S3_CLIENT')
    private readonly s3Client: S3Client,
    private readonly configService: ConfigService
  ) {
    this.bucketName = this.configService.get<string>('S3_BUCKET', 'bkdocs');
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`Bucket already exists: ${this.bucketName}`);
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        this.logger.log(`Created bucket: ${this.bucketName}`);
      } else {
        this.logger.error(`Failed to ensure bucket "${this.bucketName}": ${error.message}`);
      }
    }
  }

  /** Presigned URL để tải file trực tiếp */
  async getPresignedDownloadUrl(
    fileKey: string,
    fileName?: string,
    download = false,
    expiresInSeconds = 3600
  ): Promise<string> {
    try {
      let contentDisposition: string | undefined = undefined;

      if (download) {
        const sanitizedFileName = fileName || 'downloaded-file';
        // Encode filename theo RFC 5987 để hỗ trợ Unicode (tiếng Việt)
        const encodedFileName = encodeURIComponent(sanitizedFileName);
        contentDisposition = `attachment; filename="${sanitizedFileName.replace(/[^\x00-\x7F]/g, '_')}"; filename*=UTF-8''${encodedFileName}`;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ResponseContentDisposition: contentDisposition,
      });
      const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });

      this.logger.log(`Generated presigned URL for: ${fileKey}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new InternalServerErrorException('Cannot generate download URL');
    }
  }

  async uploadFile(file: Express.Multer.File, folder = 'documents'): Promise<string> {
    try {
      const key = `${folder}/${Date.now()}-${randomUUID()}-${file.originalname}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);
      return key;
    } catch (err) {
      console.error('Upload to S3 failed:', err);
      throw new InternalServerErrorException('Không thể tải file lên S3');
    }
  }

  /**
   * Get file buffer from S3 for AI processing
   */
  async getFileBuffer(fileKey: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as any;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      this.logger.log(`Downloaded file buffer for: ${fileKey}`);
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to get file buffer from S3: ${error.message}`);
      throw new InternalServerErrorException(`Cannot download file from S3: ${error.message}`);
    }
  }
}
