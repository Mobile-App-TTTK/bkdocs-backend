import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { S3Module } from '@modules/s3/s3.module';
import { Faculty } from '@modules/documents/entities/faculty.entity';
import { DocumentsModule } from '@modules/documents/documents.module';
import { Subject } from '@modules/documents/entities/subject.entity';

@Module({
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
  imports: [
    forwardRef(() => DocumentsModule),
    S3Module,
    TypeOrmModule.forFeature([User, Faculty, Subject]),
  ],
})
export class UsersModule {}
