import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { Document } from '../documents/entities/document.entity';
import { User } from '../users/entities/user.entity';
import { S3Module } from '@modules/s3/s3.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ConfigModule,
    S3Module,
    forwardRef(() => DocumentsModule),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
