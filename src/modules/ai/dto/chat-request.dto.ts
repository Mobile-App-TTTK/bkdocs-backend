import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UserRole } from '@common/enums/user-role.enum';

export class ChatHistoryItemDto {
  @ApiProperty({ description: 'Vai trò', enum: UserRole })
  @IsString()
  @IsIn([UserRole.ADMIN, UserRole.STUDENT])
  role: UserRole.ADMIN | UserRole.STUDENT;

  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Tìm tài liệu về Giải Tích 1',
    maxLength: 2000,
  })
  @IsString()
  @MaxLength(2000)
  content: string;
}

export class ChatRequestDto {
  @ApiProperty({
    description: 'Tin nhắn của người dùng',
    example: 'Tìm tài liệu về Giải Tích 1',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  message: string;

  @ApiProperty({
    description: 'Lịch sử hội thoại gần nhất (tối đa 10 tin)',
    required: false,
    type: [ChatHistoryItemDto],
  })
  @IsOptional()
  @IsArray({ message: 'Lịch sử hội thoại phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}
