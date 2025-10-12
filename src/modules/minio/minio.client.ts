import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';

export const createMinioClient = (configService: ConfigService) => {
  return new Client({
    endPoint: configService.get<string>('MINIO_ENDPOINT', 'minio'),
    port: parseInt(configService.get<string>('MINIO_PORT', '9000'), 10),
    useSSL: configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
    accessKey: configService.get<string>('MINIO_ACCESS_KEY', 'admin'),
    secretKey: configService.get<string>('MINIO_SECRET_KEY', 'admin123'),
  });
};
