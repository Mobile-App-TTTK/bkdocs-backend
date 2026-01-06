import { ApiProperty } from '@nestjs/swagger';

export class DocumentResponseDto {
  @ApiProperty({ example: '884330b0-3ab1-4ca3-a0f2-3929c9c39933' })
  id: string;

  @ApiProperty({ example: 'Document Title' })
  title: string;

  @ApiProperty({ example: 'Document Description' })
  description: string;

  @ApiProperty({ example: ['Khoa máy tính', 'Khoa Hóa'] })
  faculties: string[];

  @ApiProperty({ example: 'Giải tích 1' })
  subject: string  | null;

  @ApiProperty({
    example: { name: 'John Doe', id: '123', isVerified: true },
  })
  uploader: {
    name: string;
    id: string;
    isVerified: boolean;
    createdAt: Date;
  };

  @ApiProperty({ example: 'https://example.com/thumbnail.jpg' })
  thumbnailUrl: string;

  @ApiProperty({ example: 'https://example.com/file.pdf' })
  fileUrl: string;

  @ApiProperty({ example: 'application/pdf' })
  fileType: string;

  @ApiProperty({ example: 'lecture' })
  documentType: string;

  @ApiProperty({ example: 'https://example.com/download/file.pdf' })
  downloadUrl: string;

  @ApiProperty({ example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'] })
  imageUrls: string[];

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  uploadDate: Date;

  @ApiProperty({ example: 100 })
  downloadCount: number;

  @ApiProperty({ example: 4.5, required: false })
  overallRating?: number;
  constructor(partial: Partial<DocumentResponseDto>) {
    Object.assign(this, partial);
  }
}
