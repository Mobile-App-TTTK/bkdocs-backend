import { ApiProperty } from '@nestjs/swagger';

export class AdminMemberDto {
  @ApiProperty({ example: 'user-id-123' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  name: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/avatars/user-123.jpg', required: false })
  imageUrl?: string;

  @ApiProperty({ example: false })
  isBanned: boolean;

  @ApiProperty({ example: 500 })
  followerCount: number;

  @ApiProperty({ example: 36 })
  uploadedDocumentsCount: number;
}
