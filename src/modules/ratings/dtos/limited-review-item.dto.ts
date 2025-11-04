import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class LimitedReviewItemDto {
  @ApiProperty() userName: string;
  @ApiProperty() score: number;
  @ApiPropertyOptional() comment?: string | null;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiPropertyOptional() ratedAt?: Date | null;

  constructor(partial: Partial<LimitedReviewItemDto>) {
    Object.assign(this, partial);
  }
}
