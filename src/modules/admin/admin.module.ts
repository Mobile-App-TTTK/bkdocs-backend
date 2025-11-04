import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { DocumentsModule } from '@modules/documents/documents.module';
import { UsersModule } from '@modules/users/user.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [DocumentsModule, UsersModule],
})
export class AdminModule {}
