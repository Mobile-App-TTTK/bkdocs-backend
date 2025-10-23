import { ApiProperty, PartialType } from '@nestjs/swagger';

export class GetUserProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() role: string;
  @ApiProperty({ required: false }) imageUrl?: string;
  @ApiProperty({ required: false }) faculty?: string;
  @ApiProperty({ required: false }) yearOfStudy?: number;
  constructor(partial: Partial<GetUserProfileResponseDto>) {
    Object.assign(this, partial);
  }
}
