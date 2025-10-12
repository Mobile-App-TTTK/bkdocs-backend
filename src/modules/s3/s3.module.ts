import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createS3Client } from '@modules/s3/s3.client';
import { S3Service } from '@modules/s3/s3.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'S3_CLIENT',
      inject: [ConfigService],
      useFactory: createS3Client,
    },
    S3Service,
  ],
  exports: ['S3_CLIENT', S3Service],
})
export class S3Module {}
