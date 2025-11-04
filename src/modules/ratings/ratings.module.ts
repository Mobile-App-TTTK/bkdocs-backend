import { Module } from '@nestjs/common';
import { RatesController } from './ratings.controller';
import { RatesService } from './ratings.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from './entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { User } from '@modules/users/entities/user.entity';
import { Type } from 'class-transformer';

@Module({
  controllers: [RatesController],
  providers: [RatesService],
  imports: [TypeOrmModule.forFeature([Rating, Comment, Document, User])],
})
export class RatesModule {}
