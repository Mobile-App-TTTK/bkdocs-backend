import { ApiProperty } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  title: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  faculty: string;
  @ApiProperty()
  subject: string;
  @ApiProperty()
  uploader: string;
  @ApiProperty()
  fileKey: string;
  @ApiProperty()
  thumbnailKey: string;
  @ApiProperty()
  downloadUrl: string;
  @ApiProperty()
  uploadDate: Date;

  constructor(partial: Partial<DocumentResponseDto>) {
    Object.assign(this, partial);
  }
}
