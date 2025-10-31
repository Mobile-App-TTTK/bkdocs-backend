import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsIn } from 'class-validator';

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
  @ApiPropertyOptional({ description: 'Loại file', enum: ['word', 'pdf', 'image', 'powerpoint'] })
  @IsOptional()
  @IsString()
  @IsIn(['word', 'pdf', 'image', 'powerpoint'])
  type?: 'word' | 'pdf' | 'image' | 'powerpoint';

  @ApiPropertyOptional({ description: "Sort mode", enum: ['newest', 'oldest', 'downloadCount'] })
  @IsOptional()
  @IsString()
  @IsIn(['newest', 'oldest', 'downloadCount'])
  sort?: 'newest' | 'oldest' | 'downloadCount';

  @ApiPropertyOptional({ description: "Search branch", default: 'all', enum: ['all', 'faculty', 'subject', 'user'] })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'faculty', 'subject', 'user'])
  searchFor?: 'all' | 'faculty' | 'subject' | 'user';
}
