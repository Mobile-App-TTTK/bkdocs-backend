import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';

export const createMinioClient = (configService: ConfigService) => {
  return new Client({
    endPoint: configService.get<string>('MINIO_ENDPOINT', 'minio-ui.inkwhale.io.vn'),
    port: parseInt(configService.get<string>('MINIO_PORT', '443'), 10),
    useSSL: true,
    accessKey: configService.get<string>('MINIO_ACCESS_KEY'),
    secretKey: configService.get<string>('MINIO_SECRET_KEY'),
  });
};
