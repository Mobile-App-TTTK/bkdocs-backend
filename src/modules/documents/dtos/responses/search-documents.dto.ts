import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SearchDocumentsDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Khoa (Faculty)' })
  @IsOptional()
  faculty?: string;

  @ApiPropertyOptional({ description: 'Môn học (Subject)' })
  @IsOptional()
  subject?: string;
}
