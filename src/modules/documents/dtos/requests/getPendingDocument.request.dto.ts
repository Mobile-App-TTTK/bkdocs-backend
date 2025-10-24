// src/modules/documents/dto/request/get-pending-documents.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetPendingDocumentsDto {
  @ApiProperty({
    example: 5,
    description: 'Số lượng tài liệu cần lấy (mặc định: 10)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
