import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserProfileDto {
  @ApiProperty({ example: 'John Doe', required: false })
  name?: string;

  @ApiProperty({ example: '4e5fe7ad-5163-4278-8592-8a89e67a17c5', required: false })
  facultyId?: string;

  @ApiProperty({ example: 3, required: false })
  yearOfStudy?: number;

  constructor(partial: Partial<UpdateUserProfileDto>) {
    Object.assign(this, partial);
  }
}
