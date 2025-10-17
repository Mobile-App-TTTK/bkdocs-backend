import { Controller, Get, Param, Query, Logger, UseGuards, BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiParam, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { DownloadDocumentUrlResponseDto } from './dtos/responses/downloadDocumentUrl.response.dto';
import { ApiResponseSwaggerWrapper } from '@common/decorators/api-response-swagger-wapper.decorator';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { Document } from '@modules/documents/entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';

@ApiTags('documents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Get('search')
  @ApiOkResponse({ type: [Document] })
  async search(@Query() q: SearchDocumentsDto): Promise<(Document & { rank?: number })[]> {
    const empty =
      (!q.keyword || q.keyword.trim() === '') &&
      !q.faculty &&
      !q.subject;

    if (empty) {
      throw new BadRequestException('Ít nhất một trong các trường keyword, faculty, subject phải có.');
    }

    return this.documentsService.search(q);
  }

  @Get('suggest')
  @ApiQuery({ name: 'keyword', required: true })
  @ApiOkResponse({ description: 'Suggest Keyword', type: [String] })
  async suggest(@Query('keyword') keyword: string): Promise<string[]> {
    if (!keyword || !keyword.trim()) {
      throw new BadRequestException('keyword is required');
    }
    return this.documentsService.suggest(keyword);
  }
}
