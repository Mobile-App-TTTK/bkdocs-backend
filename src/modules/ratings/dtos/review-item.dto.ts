import { ApiProperty } from '@nestjs/swagger';

export class ReviewItemDto {
  @ApiProperty() userName: string;
  @ApiProperty() score: number;
  @ApiProperty() comment: string | null;
}