import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({ description: 'Câu trả lời từ AI' })
  reply: string;

  @ApiProperty({ description: 'Thời gian phản hồi' })
  timestamp: string;

  @ApiProperty({ description: 'Loại yêu cầu được phát hiện', required: false })
  intent?: string;

  @ApiProperty({ description: 'Các hành động gợi ý', required: false })
  suggestedActions?: string[];
}
