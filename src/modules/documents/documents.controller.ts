import { Controller, Get, Param, Res, Logger, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiParam } from '@nestjs/swagger';
import { DownloadDocumentUrlResponseDto } from './dtos/responses/downloadDocumentUrl.response.dto';

@ApiTags('documents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}


  @Get(':id/download')
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID của tài liệu cần tải xuống',
    example: '884330b0-3ab1-4ca3-a0f2-3929c9c39933',
  })
  async download(@Param('id') id: string) {
      const url : string = await this.documentsService.getDownloadUrl(id);
      return new DownloadDocumentUrlResponseDto({ url });
      // return url;
  }
}
