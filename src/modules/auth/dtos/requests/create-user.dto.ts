import { IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', description: 'Tên đầy đủ' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email duy nhất' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '121314aA!', description: 'Mật khẩu tối thiểu 8 ký tự bao gồm chữ số, chữ cái và kí tự đặc biệt ' })
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: 'Password phải chứa ít nhất 1 chữ cái, 1 số và 1 ký tự đặc biệt',
  })
  password: string;
}
