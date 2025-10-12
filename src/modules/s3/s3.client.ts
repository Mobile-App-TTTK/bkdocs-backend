import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { AwsCredentialIdentity } from '@aws-sdk/types';

export const createS3Client = (configService: ConfigService) => {
  const credentials: AwsCredentialIdentity = {
    accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID', ''),
    secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
  };

  return new S3Client({
    region: configService.get<string>('AWS_REGION', 'ap-southeast-1'),
    credentials,
  });
};
