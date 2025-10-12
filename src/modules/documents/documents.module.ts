import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { Subject } from './entities/subject.entity';
import { Faculty } from './entities/falcuty.entity';
import { User } from '@modules/users/entities/user.entity';
import { Rating } from '@modules/ratings/entities/rating.entity';
import { Type } from 'class-transformer';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  imports: [TypeOrmModule.forFeature([Document, Subject, Faculty, User, Rating])],
})
export class DocumentsModule {}
