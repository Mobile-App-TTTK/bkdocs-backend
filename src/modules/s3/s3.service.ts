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
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;

  constructor(
    @Inject('S3_CLIENT')
    private readonly s3Client: S3Client,
    private readonly configService: ConfigService,
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
  async getPresignedDownloadUrl(fileKey: string, fileName: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ResponseContentDisposition: `attachment; filename="${fileName}"`,
      });
      
      const url = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });

      this.logger.log(`Generated presigned URL for: ${fileKey}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new InternalServerErrorException('Cannot generate download URL');
    }
  }
}
