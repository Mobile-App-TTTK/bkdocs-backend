import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

@ApiTags('ai')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chat với AI Assistant',
    description: `
Trò chuyện với trợ lý AI thông minh để:
-  Tìm kiếm tài liệu học tập
-  Nhận gợi ý tài liệu cá nhân hóa  
-  Tóm tắt nội dung tài liệu
-  Hỏi đáp về tài liệu và môn học
-  Giải đáp thắc mắc kiến thức
**Ví dụ sử dụng:**
- "Tìm tài liệu về Giải Tích 1"
- "Gợi ý tài liệu cho tôi"
- "Tóm tắt tài liệu 884330b0-3ab1-4ca3-a0f2-3929c9c39933"
- "Giải thích về đạo hàm"
- "Cách học môn Cấu trúc dữ liệu hiệu quả"
    `,
  })
  @ApiBody({
    type: ChatRequestDto,
    description: 'Tin nhắn chat',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phản hồi thành công từ AI',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
    schema: {
      example: {
        statusCode: 400,
        message: ['Tin nhắn không được để trống'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  async chat(@Body() chatRequest: ChatRequestDto, @Req() req: any): Promise<ChatResponseDto> {
    const userId = req.user.userId;
    if (chatRequest.history && chatRequest.history.length > 10) {
      chatRequest.history = chatRequest.history.slice(-10);
    }
    return this.aiService.chat(chatRequest.message, userId, chatRequest.history);
  }
}
