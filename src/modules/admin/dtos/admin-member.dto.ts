import { ApiProperty } from '@nestjs/swagger';

export class AdminMemberDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  name: string;

  @ApiProperty({ example: false })
  isBanned: boolean;

  @ApiProperty({ example: 500 })
  followerCount: number;

  @ApiProperty({ example: 36 })
  uploadedDocumentsCount: number;

  @ApiProperty({ example: 'user-id-123' })
  id: string;
}
