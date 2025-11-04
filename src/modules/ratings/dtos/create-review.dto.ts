import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsString, MinLength } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  content: string;
}
