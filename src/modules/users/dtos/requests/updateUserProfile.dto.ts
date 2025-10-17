import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserProfileDto {
  @ApiProperty({ example: 'Nguyễn Minh Khánh', required: false })
  name?: string;

  @ApiProperty({ example: 'avatar.png', required: false })
  imageKey?: string;
}
