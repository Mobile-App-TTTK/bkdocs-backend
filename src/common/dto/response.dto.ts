import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class ResponseDto<T = any> {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Thao tác thành công', required: false })
  message?: string;

  @ApiProperty({
    description: 'Dữ liệu trả về (nếu có)',
    required: false,
  })
  @ValidateNested()
  @Type(() => Object)
  data?: T;

  constructor(partial: Partial<ResponseDto<T>>) {
    Object.assign(this, partial);
  }

  static success<T>(data?: T, message = 'Thành công', statusCode = 200): ResponseDto<T> {
    return new ResponseDto<T>({
      statusCode,
      success: true,
      message,
      data,
    });
  }

  static error(message: string, statusCode = 400): ResponseDto<null> {
    return new ResponseDto<null>({
      statusCode,
      success: false,
      message,
      data: null,
    });
  }
}
