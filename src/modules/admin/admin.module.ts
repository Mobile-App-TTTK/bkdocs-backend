import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { DocumentsModule } from '@modules/documents/documents.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [DocumentsModule],
})
export class AdminModule {}
