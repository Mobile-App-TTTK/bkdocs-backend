import { forwardRef, Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { Subject } from './entities/subject.entity';
import { Faculty } from './entities/faculty.entity';
import { User } from '@modules/users/entities/user.entity';
import { Rating } from '@modules/ratings/entities/rating.entity';
import { Image } from '@modules/documents/entities/image.entity';
import { ConfigService } from '@nestjs/config';
import { S3Module } from '@modules/s3/s3.module';
import { UsersModule } from '@modules/users/user.module';
import { FacultyYearSubject } from './entities/faculty-year-subject.entity';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { DocumentType } from '@modules/documents/entities/document-type.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, ConfigService],
  imports: [
    forwardRef(() => UsersModule),
    S3Module,
    TypeOrmModule.forFeature([
      Document,
      DocumentType,
      Subject,
      Faculty,
      User,
      Rating,
      Image,
      FacultyYearSubject,
      Comment,
    ]),
    NotificationsModule,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
