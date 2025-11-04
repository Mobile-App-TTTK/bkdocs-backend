import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from './entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { User } from '@modules/users/entities/user.entity';
import { RatesService } from './ratings.service';
import { RatesController } from './ratings.controller';
import { S3Module } from '@modules/s3/s3.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rating, Comment, Document, User]),
    S3Module,
  ],
  providers: [RatesService],
  controllers: [RatesController],
})
export class RatesModule {}