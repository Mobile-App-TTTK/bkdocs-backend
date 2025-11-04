import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterCompleteDto {
  @ApiProperty({ example: 'New User' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'khanhzip14@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '121314aA!' })
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'reset-token-from-verify-otp' })
  @IsNotEmpty()
  token: string;
}
