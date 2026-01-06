import { ApiProperty, PartialType } from '@nestjs/swagger';

export class GetUserProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() role: string;
  @ApiProperty({ required: false }) imageUrl?: string;
  @ApiProperty({ required: false }) faculty?: string;
  @ApiProperty({ required: false }) intakeYear?: number;
  @ApiProperty() documentCount?: number;
  @ApiProperty() numberFollowers: number;
  @ApiProperty() participationDays: number;
  @ApiProperty() isFollowed: boolean;
  constructor(partial: Partial<GetUserProfileResponseDto>) {
    Object.assign(this, partial);
  }
}
