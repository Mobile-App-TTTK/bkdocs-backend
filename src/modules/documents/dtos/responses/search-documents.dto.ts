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

  @ApiPropertyOptional({ description: 'Loại file' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "Sorting: 'asc' hoặc 'desc'" })
  @IsOptional()
  @IsString()
  sort?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: "Search branch: 'documents' hoặc 'faculty' hoặc 'subject'", default: 'documents' })
  @IsOptional()
  @IsString()
  searchFor?: 'documents' | 'faculty' | 'subject';
}
