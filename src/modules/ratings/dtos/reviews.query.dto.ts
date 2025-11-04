import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsEnum } from 'class-validator';

export enum ReviewScoreFilter {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
}

export class ReviewsQueryDto {
  @ApiProperty({ description: 'ID tài liệu' })
  @IsUUID()
  documentId: string;

  @ApiPropertyOptional({ enum: ReviewScoreFilter, description: 'Filter' })
  @IsOptional()
  @IsEnum(ReviewScoreFilter)
  score?: ReviewScoreFilter;
}