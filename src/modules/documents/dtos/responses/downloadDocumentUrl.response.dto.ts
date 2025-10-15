import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DownloadDocumentUrlResponseDto {
  constructor(partial: Partial<DownloadDocumentUrlResponseDto>) {
    Object.assign(this, partial);
  }
  @ApiProperty({
    description: 'URL tải xuống tài liệu',
    example:
      'https://bkdocs-hcmut.s3.ap-southeast-1.amazonaws.com/Giao_trinh_GT1.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAXV6VSQF6CSGKZP77%2F20251015%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20251015T003223Z&X-Amz-Expires=3600&X-Amz-Signature=bd7e46fc06eefebbe6c4bfea4f9260c5b27acf6edbb1726cf1692952c80f318c&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject',
  })
  @IsString()
  url: string;
}