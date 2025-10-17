import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RegisterRequestOtpDto {
  @ApiProperty({ example: 'newuser@example.com' })
  @IsEmail()
  email: string;
}
