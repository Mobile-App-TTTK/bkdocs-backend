import { Controller, Get, Param, Res, Logger, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { Response } from 'express';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DownloadDocumentUrlResponseDto } from './dtos/responses/downloadDocumentUrl.response.dto';

@ApiTags('documents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}


  @Get(':id/download')
  async download(@Param('id') id: string) {
      const url : string = await this.documentsService.getDownloadUrl(id);
      return new DownloadDocumentUrlResponseDto({ url });
      // return url;
  }
}
