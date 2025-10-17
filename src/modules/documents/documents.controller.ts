import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  UseGuards,
  BadRequestException,
  Req,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UploadedFiles,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiParam,
  ApiOkResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { DownloadDocumentUrlResponseDto } from './dtos/responses/downloadDocumentUrl.response.dto';
import { ApiResponseSwaggerWrapper } from '@common/decorators/api-response-swagger-wapper.decorator';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { Document } from '@modules/documents/entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { SuggestDocumentsResponseDto } from './dtos/responses/suggestDocument.response.dto';
import { Public } from '@common/decorators/public.decorator';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AllFacultiesAndSubjectsDto } from './dtos/responses/allFalcutiesAndSubjects.response.dto';
import { DocumentResponseDto } from './dtos/responses/document.response.dto';
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
    const empty = (!q.keyword || q.keyword.trim() === '') && !q.faculty && !q.subject;

    if (empty) {
      throw new BadRequestException(
        'Ít nhất một trong các trường keyword, faculty, subject phải có.'
      );
    }

    return this.documentsService.search(q);
  }

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
  }

  @ApiResponseSwaggerWrapper(SuggestDocumentsResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  @Public()
  @Get('suggestions')
  async getSuggestions(): Promise<SuggestDocumentsResponseDto> {
    return this.documentsService.getSuggestions();
  }

  @ApiResponseSwaggerWrapper(SuggestDocumentsResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  @Get('user/suggestions')
  async getUserSuggestions(@Req() req: any): Promise<SuggestDocumentsResponseDto> {
    const userId: string = req.user.id;
    return this.documentsService.getUserSuggestions(userId);
  }

  @Post('upload')
  @ApiResponseSwaggerWrapper(DocumentResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'thumbnailFile', maxCount: 1 },
        { name: 'images', maxCount: 6 },
      ],
      {
        limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
        fileFilter: (req, file, cb) => {
          const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'image/jpeg',
            'image/png',
            'image/gif',
          ];

          if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(
              new BadRequestException(`File loại ${file.mimetype} không được hỗ trợ`),
              false
            );
          }

          cb(null, true); // cho phép file hợp lệ
        },
      }
    )
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        facultyId: { type: 'string', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
        subjectId: { type: 'string', example: 'c9b1d5f4-3e2a-4d5b-8f4d-1c2b3a4d5e6f' },
        description: { type: 'string', example: 'Tài liệu về cơ sở dữ liệu' },
        thumbnailFile: { type: 'string', format: 'binary' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  async uploadFile(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnailFile?: Express.Multer.File;
      images?: Express.Multer.File[];
    },
    @Body('facultyId') facultyId: string,
    @Body('subjectId') subjectId: string,
    @Body('description') description: string,
    @Req() req: any
  ): Promise<DocumentResponseDto> {
    const userId = req.user.id;
    if (!files.file?.length) throw new BadRequestException('Thiếu file tài liệu chính');

    return this.documentsService.uploadDocument(
      files.file[0],
      files.images || [],
      userId,
      files.thumbnailFile,
      facultyId,
      subjectId,
      description
    );
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

  @ApiResponseSwaggerWrapper(AllFacultiesAndSubjectsDto)
  @ApiErrorResponseSwaggerWrapper()
  @Get('falculties-subjects/all')
  async getAllFacultiesAndSubjects(): Promise<AllFacultiesAndSubjectsDto> {
    return this.documentsService.getAllFacultiesAndSubjects();
  }
}
