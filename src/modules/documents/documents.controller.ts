import { Controller, Get, Param, Res, Logger, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiParam, ApiResponse } from '@nestjs/swagger';
import { DownloadDocumentUrlResponseDto } from './dtos/responses/downloadDocumentUrl.response.dto';
import { ApiResponseSwaggerWrapper } from '@common/decorators/api-response-swagger-wapper.decorator';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';

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
  // {
  //   "statusCode": 200,
  //   "success": true,
  //   "data": {
  //     "url": "https://bkdocs-hcmut.s3.ap-southeast-1.amazonaws.com/Giao_trinh_GT1.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAXV6VSQF6CSGKZP77%2F20251015%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20251015T003223Z&X-Amz-Expires=3600&X-Amz-Signature=bd7e46fc06eefebbe6c4bfea4f9260c5b27acf6edbb1726cf1692952c80f318c&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
  //   }
  // }
  @ApiResponseSwaggerWrapper(DownloadDocumentUrlResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  async download(@Param('id') id: string): Promise<DownloadDocumentUrlResponseDto> {
    const url: string = await this.documentsService.getDownloadUrl(id);
    return new DownloadDocumentUrlResponseDto({ url });
    // return url;
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID của tài liệu cần lấy thông tin',
    example: '884330b0-3ab1-4ca3-a0f2-3929c9c39933',
  })
  @ApiResponseSwaggerWrapper(DetailsDocumentResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  async getDocumentById(@Param('id') id: string): Promise<DetailsDocumentResponseDto> {
    const document = await this.documentsService.getDocumentById(id);
    return document;
  }
}
