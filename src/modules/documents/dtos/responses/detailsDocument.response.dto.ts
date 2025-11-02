import { Document } from '@modules/documents/entities/document.entity';
import { ApiProperty } from '@nestjs/swagger';

export class DetailsDocumentResponseDto {
  //   "id": "884330b0-3ab1-4ca3-a0f2-3929c9c39933",
  // "title": "Giáo trình Giải Tích 1",
  // "description": "Giáo trình Giải Tích 1 (NXB Đại Học Quốc Gia 2013) - Nguyễn Đình Huy, 263 trang.",
  // "fileKey": "Giao_trinh_GT1.pdf",
  // "thumbnailKey": null,
  // "downloadCount": 0,
  // "status": "active",
  // "uploadDate": "2025-10-11T19:10:28.735Z",
  // "uploader": null,
  // "subject": null,
  // "faculty": null,
  // "images": []
  @ApiProperty({ example: '884330b0-3ab1-4ca3-a0f2-3929c9c39933' })
  id: string;

  @ApiProperty({ example: 'Giáo trình Giải Tích 1' })
  title: string;

  @ApiProperty({
    example: 'Giáo trình Giải Tích 1 (NXB Đại Học Quốc Gia 2013) - Nguyễn Đình Huy, 263 trang.',
  })
  description: string;

  @ApiProperty({ example: 'Giao_trinh_GT1.pdf' })
  fileKey: string;

  @ApiProperty({ example: null, nullable: true })
  thumbnailKey: string;

  @ApiProperty({ example: 0 })
  downloadCount: number;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: '2025-10-11T19:10:28.735Z' })
  uploadDate: Date;

  @ApiProperty({ example: null, nullable: true })
  uploader: string | null;

  @ApiProperty({ example: null, nullable: true })
  subject: string | null;

  @ApiProperty({ example: null, nullable: true })
  faculties: string | null;

  @ApiProperty({ type: () => [String], example: [] })
  images: string[];

  overallRating?: number;

  constructor(partial: Partial<DetailsDocumentResponseDto>) {
    Object.assign(this, partial);
  }
}
