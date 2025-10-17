import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { Faculty } from '@modules/documents/entities/falcuty.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { User } from '@modules/users/entities/user.entity';
import { NotificationsGateway } from './notifications.gateway';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  imports: [TypeOrmModule.forFeature([Notification, Faculty, Subject, User])],
  exports: [NotificationsService],
})
export class NotificationsModule {}
