import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RegisterRequestOtpDto {
  @ApiProperty({ example: 'khanhzip14@gmail.com' })
  @IsEmail()
  email: string;
}
