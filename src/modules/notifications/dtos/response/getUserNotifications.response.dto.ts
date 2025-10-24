import { Notification } from '@modules/notifications/entities/notification.entity';
import { ApiProperty } from '@nestjs/swagger';

export class GetUserNotificationsResponseDto {
  @ApiProperty()
  data: UserNotificationDto[];
  @ApiProperty()
  total: number;
  @ApiProperty()
  page: number;
  @ApiProperty()
  totalPages: number;

  constructor(partial: Partial<GetUserNotificationsResponseDto>) {
    Object.assign(this, partial);
  }
}
export class UserNotificationDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  type: string;
  @ApiProperty()
  targetId: string;
  @ApiProperty()
  message: string;
  @ApiProperty()
  isRead: boolean;
  @ApiProperty()
  createdAt: Date;

  constructor(notification: Notification) {
    this.id = notification.id;
    this.type = notification.type;
    this.targetId = notification.targetId;
    this.message = notification.message;
    this.isRead = notification.isRead;
    this.createdAt = notification.createdAt;
  }
}
