import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { DocumentsModule } from '@modules/documents/documents.module';
import { UsersModule } from '@modules/users/user.module';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [
    TypeOrmModule.forFeature([User, Document]),
    DocumentsModule,
    UsersModule,
  ],
})
export class AdminModule {}
