import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createMinioClient } from '@modules/minio/minio.client';
import { MinioService } from '@modules/minio/minio.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'MINIO_CLIENT',
      inject: [ConfigService],
      useFactory: createMinioClient,
    },
    MinioService, 
  ],
  exports: ['MINIO_CLIENT', MinioService],
})
export class MinioModule {}
