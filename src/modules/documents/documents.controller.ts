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
  Body,
  UploadedFiles,
  Patch,
  NotFoundException,
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
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { DownloadDocumentUrlResponseDto } from './dtos/responses/downloadDocumentUrl.response.dto';
import { ApiResponseSwaggerWrapper } from '@common/decorators/api-response-swagger-wapper.decorator';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { Document } from '@modules/documents/entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { SuggestDocumentsResponseDto } from './dtos/responses/suggestDocument.response.dto';
import { Public } from '@common/decorators/public.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AllFacultiesAndSubjectsDto } from './dtos/responses/allFalcutiesAndSubjects.response.dto';
import { DocumentResponseDto } from './dtos/responses/document.response.dto';
import { subscribe } from 'diagnostics_channel';
import { Subject } from './entities/subject.entity';;
import { RolesGuard } from '@common/guards/role.guard';
import { Roles } from '@common/decorators/role.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { GetPendingDocumentsDto } from './dtos/requests/getPendingDocument.request.dto';
@ApiTags('documents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly logger: Logger
  ) {}

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

  @Get('suggest/keyword')
  @ApiQuery({ name: 'keyword', required: true })
  @ApiOkResponse({ description: 'Suggest Keyword', type: [String] })
  async suggest(@Query('keyword') keyword: string): Promise<string[]> {
    if (!keyword || !keyword.trim()) {
      throw new BadRequestException('keyword is required');
    }
    return this.documentsService.suggest(keyword);
  }

  @Get('suggest/subject')
  @ApiOkResponse({ type: [Subject] })
  async suggestSubject(@Req() req): Promise<Subject[]> {
    return this.documentsService.suggestSubjectsForUser((req as any).user.userId);
  }

  @Get(':id/download')
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID của tài liệu cần tải xuống',
    example: '884330b0-3ab1-4ca3-a0f2-3929c9c39933',
  })
  @ApiResponseSwaggerWrapper(DownloadDocumentUrlResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  async download(@Param('id') id: string): Promise<DownloadDocumentUrlResponseDto> {
    this.logger.log(`Tạo URL tải xuống cho tài liệu ID: ${id}`);
    const url: string = await this.documentsService.getDownloadUrl(id);
    return new DownloadDocumentUrlResponseDto({ url });
  }

  @ApiOperation({ description: 'Lấy 3 tài liệu nhiều lượt tải nhất' })
  @ApiResponseSwaggerWrapper(SuggestDocumentsResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  @Public()
  @Get('suggestions')
  async getSuggestions(): Promise<SuggestDocumentsResponseDto> {
    this.logger.log('Lấy gợi ý tài liệu cho người dùng không đăng nhập');
    return this.documentsService.getSuggestions();
  }

  @ApiOperation({ description: 'Lấy 6 tài liệu theo khoa của user' })
  @ApiResponseSwaggerWrapper(SuggestDocumentsResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  @Get('user/suggestions')
  async getUserSuggestions(@Req() req: any): Promise<SuggestDocumentsResponseDto> {
    this.logger.log(`Lấy gợi ý tài liệu cho người dùng ID: ${req.user.id}`);
    const userId: string = req.user.id;
    return this.documentsService.getUserSuggestions(userId);
  }

  @Post('upload')
  @ApiOperation({ description: 'Upload tài liệu lên' })
  @ApiResponseSwaggerWrapper(DocumentResponseDto, { status: 201 })
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
    this.logger.log(`Người dùng ID: ${req.user.id} đang tải lên tài liệu mới`);
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

  @ApiErrorResponseSwaggerWrapper()
  @Get('pending/:limit')
  @ApiOperation({ summary: 'Lấy danh sách tài liệu đang chờ duyệt' })
  @ApiParam({ name: 'limit', example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Danh sách tài liệu đang chờ duyệt',
    type: [Document],
  })
  @ApiErrorResponseSwaggerWrapper()
  async getPendingDocuments(@Param('limit') limit: number): Promise<Document[]> {
    return this.documentsService.getPendingDocuments(limit || 10);
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Duyệt tài liệu đang pending → active và gửi broadcast' })
  @Patch(':id/approve')
  async approveDocument(@Param('id') docId: string) {
    const document = await this.documentsService.updateDocumentStatus(docId, 'ACTIVE');

    return {
      message: `Đã duyệt tài liệu ${document.title} và gửi thông báo tới người dùng.`,
    };
  }

  @ApiOperation({ description: 'Lấy tất cả khoa và môn học (ID và tên)' })
  @ApiResponseSwaggerWrapper(Document)
  @ApiErrorResponseSwaggerWrapper()
  @Get('falculties-subjects/all')
  async getAllFacultiesAndSubjects(): Promise<AllFacultiesAndSubjectsDto> {
    this.logger.log('Lấy tất cả khoa và môn học');
    return this.documentsService.getAllFacultiesAndSubjects();
  }

  @Get(':id')
  @ApiOperation({ description: 'Trả về thông tin chi tiết của một tài liệu' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID của tài liệu cần lấy thông tin',
    example: '884330b0-3ab1-4ca3-a0f2-3929c9c39933',
  })
  @ApiResponseSwaggerWrapper(DetailsDocumentResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  async getDocumentById(@Param('id') id: string): Promise<DetailsDocumentResponseDto> {
    this.logger.log(`Lấy thông tin chi tiết cho tài liệu ID: ${id}`);
    const document = await this.documentsService.getDocumentById(id);
    return document;
  }
}
