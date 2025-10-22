import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Logger,
  Req,
  BadRequestException,
  Delete,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { GetUserNotificationsResponseDto } from './dtos/response/getUserNotifications.response.dto';
import { Notification } from './entities/notification.entity';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
@ApiErrorResponseSwaggerWrapper()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly logger: Logger
  ) {}

  @ApiOperation({ summary: 'Đánh dấu đã đọc notification' })
  @ApiParam({ name: 'id', required: true, description: 'ID of the notification' })
  @Patch(':id/mark-as-read')
  async markAsRead(@Param('id') notificationId: string): Promise<Notification> {
    return this.notificationsService.markAsRead(notificationId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Lấy danh sách thông báo của một user (có phân trang)' })
  @ApiParam({ name: 'userId', required: true, description: 'ID của user' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Trang hiện tại (mặc định = 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Số lượng thông báo mỗi trang (mặc định = 10)',
  })
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10
  ): Promise<GetUserNotificationsResponseDto> {
    return this.notificationsService.getUserNotifications(userId, page, limit);
  }

  @ApiParam({ name: 'facultyId', example: '243064f6-f97d-410d-b23d-68b4dbf417b8' })
  @ApiOperation({ summary: 'Đăng ký theo dõi một khoa' })
  @Post('faculty/:facultyId/subscribe')
  async subscribeFaculty(@Param('facultyId') facultyId: string, @Req() req: any) {
    const userId = req.user.id;
    if (!facultyId) throw new BadRequestException('Thiếu facultyId');

    return this.notificationsService.subscribeFaculty(userId, facultyId);
  }

  @ApiParam({ name: 'subjectId', example: '3c926c5e-38a8-4a81-b4b1-1d93643784d6' })
  @ApiErrorResponseSwaggerWrapper({ status: 400, description: 'Thiếu subjectId' })
  @Post('subject/:subjectId/subscribe')
  @ApiOperation({ summary: 'Đăng ký theo dõi một môn học' })
  async subscribeSubject(@Param('subjectId') subjectId: string, @Req() req: any) {
    const userId = req.user.id;
    if (!subjectId) throw new BadRequestException('Thiếu subjectId');

    return this.notificationsService.subscribeSubject(userId, subjectId);
  }

  @ApiParam({ name: 'facultyId', example: '243064f6-f97d-410d-b23d-68b4dbf417b8' })
  @ApiErrorResponseSwaggerWrapper()
  @Delete('faculty/:facultyId/unsubcribe')
  @ApiOperation({ summary: 'Hủy theo dõi một khoa' })
  async unsubscribeFaculty(@Param('facultyId') facultyId: string, @Req() req: any) {
    const userId = req.user.id;
    if (!facultyId) throw new BadRequestException('Thiếu facultyId');

    return this.notificationsService.unsubscribeFaculty(userId, facultyId);
  }

  @ApiParam({ name: 'subjectId', example: '3c926c5e-38a8-4a81-b4b1-1d93643784d6' })
  @ApiErrorResponseSwaggerWrapper({ status: 400, description: 'Thiếu subjectId' })
  @ApiOperation({ summary: 'Hủy theo dõi một môn học' })
  @Delete('subject/:subjectId/unsubcribe')
  async unsubscribeSubject(@Param('subjectId') subjectId: string, @Req() req: any) {
    const userId = req.user.id;
    if (!subjectId) throw new BadRequestException('Thiếu subjectId');

    return this.notificationsService.unsubscribeSubject(userId, subjectId);
  }
}
