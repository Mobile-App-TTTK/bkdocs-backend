import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({ example: 'khanhzip14@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '121314aA!' })
  @IsNotEmpty()
  password: string;
}
