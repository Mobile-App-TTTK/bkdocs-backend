import { Module } from '@nestjs/common';
import { UsersService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { S3Module } from '@modules/s3/s3.module';

@Module({
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
  imports: [S3Module, TypeOrmModule.forFeature([User, Notification])],
})
export class UsersModule {}
