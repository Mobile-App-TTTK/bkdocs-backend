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
  UploadedFile,
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
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { DownloadDocumentUrlResponseDto } from './dtos/responses/downloadDocumentUrl.response.dto';
import { ApiResponseSwaggerWrapper } from '@common/decorators/api-response-swagger-wapper.decorator';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { Document } from '@modules/documents/entities/document.entity';
import { DetailsDocumentResponseDto } from './dtos/responses/detailsDocument.response.dto';
import { SearchDocumentsDto } from './dtos/responses/search-documents.dto';
import { SuggestAllFacultiesDocumentsResponseDto } from './dtos/responses/suggestAllFacultiesDocument.response.dto';
import { Public } from '@common/decorators/public.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AllFacultiesAndSubjectsAndDocumentTypesDto } from './dtos/responses/allFalcutiesAndSubjects.response.dto';
import { DocumentResponseDto } from './dtos/responses/document.response.dto';
import { subscribe } from 'diagnostics_channel';
import { Subject } from './entities/subject.entity';
import { RolesGuard } from '@common/guards/role.guard';
import { Roles } from '@common/decorators/role.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { Status } from '@common/enums/status.enum';
@ApiTags('documents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly logger: Logger
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Search documents by keyword', type: [Object] })
  async search(@Query() q: SearchDocumentsDto, @Req() req): Promise<any[]> {
    const empty =
      (!q.keyword || q.keyword.trim() === '') &&
      (!q.faculty || q.faculty.trim() === '') &&
      (!q.subject || q.subject.trim() === '');

    if (empty) {
      throw new BadRequestException(
        'Ít nhất một trong các trường keyword, faculty, subject phải có.'
      );
    }

    return this.documentsService.search(q, (req as any).user.userId);
  }

  @Get('suggestion/keyword')
  @ApiQuery({ name: 'keyword', required: true })
  @ApiOkResponse({ description: 'Suggest Keyword', type: [String] })
  async suggest(@Query('keyword') keyword: string): Promise<string[]> {
    if (!keyword || !keyword.trim()) {
      throw new BadRequestException('keyword is required');
    }
    return this.documentsService.suggest(keyword);
  }

  @Get('suggestion/subject')
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

  @ApiOperation({ summary: 'Lấy 10 tài liệu nhiều lượt tải nhất' })
  @ApiResponseSwaggerWrapper(DocumentResponseDto)
  @ApiErrorResponseSwaggerWrapper()
  @Public()
  @Get('suggestions/top-downloads')
  async getSuggestions(): Promise<DocumentResponseDto[]> {
    this.logger.log('Lấy gợi ý tài liệu cho người dùng không đăng nhập');
    return this.documentsService.getSuggestions();
  }

  @ApiOkResponse({
    description: 'Suggest documents for all faculties',
    type: [SuggestAllFacultiesDocumentsResponseDto],
  })
  @ApiOperation({ summary: 'Lấy 10 tài liệu mỗi khoa' })
  @ApiErrorResponseSwaggerWrapper()
  @Get('/faculties/suggestions')
  async getAllFacultiesSuggestions(): Promise<SuggestAllFacultiesDocumentsResponseDto[]> {
    return this.documentsService.getAllFacultiesSuggestions();
  }

  @Post()
  @ApiOperation({ summary: 'Upload tài liệu lên' })
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
          // Allowed document types
          const allowedDocumentTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
          ];

          // Allowed image types - tất cả các loại ảnh phổ biến
          const allowedImageTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'image/bmp',
            'image/tiff',
            'image/x-icon',
            'image/heic',
            'image/heif',
          ];

          const allAllowedTypes = [...allowedDocumentTypes, ...allowedImageTypes];

          if (!allAllowedTypes.includes(file.mimetype)) {
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
        facultyIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['f47ac10b-58cc-4372-a567-0e02b2c3d479'],
        },
        subjectId: { type: 'string', example: 'c9b1d5f4-3e2a-4d5b-8f4d-1c2b3a4d5e6f' },
        documentTypeId: { type: 'string', example: '30d99ba0-4fb1-4b73-aa5a-fd570a746eb9' },
        title: { type: 'string', example: 'Tài liệu về Giải Tích 1' },
        description: { type: 'string', example: 'Đây là tài liệu về Giải Tích 1' },
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
      thumbnailFile?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Body('facultyIds') facultyIds: string[],
    @Body('subjectId') subjectId: string,
    @Body('documentTypeId') documentTypeId: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Req() req: any
  ): Promise<DocumentResponseDto> {
    this.logger.log(`Người dùng ID: ${req.user.userId} đang tải lên tài liệu mới`);
    const userId = req.user.userId;
    if (!files.file?.length) throw new BadRequestException('Thiếu file tài liệu chính');
    if (!files.thumbnailFile?.length) throw new BadRequestException('Thiếu file hình thu nhỏ');
    const normalizedFacultyIds =
      typeof facultyIds === 'string'
        ? (facultyIds as string).split(',').map((id) => id.trim())
        : Array.isArray(facultyIds)
          ? facultyIds
          : [];

    return this.documentsService.uploadDocument(
      files.file[0],
      files.images || [],
      userId,
      files.thumbnailFile[0],
      normalizedFacultyIds,
      subjectId,
      documentTypeId,
      title,
      description
    );
  }

  @ApiOperation({ summary: 'Lấy tất cả khoa, môn học và loại tài liệu (ID và tên)' })
  @ApiResponseSwaggerWrapper(Document)
  @ApiErrorResponseSwaggerWrapper()
  @Get('metadata')
  async getAllFacultiesAndSubjectsAndDocumentTypes(): Promise<AllFacultiesAndSubjectsAndDocumentTypesDto> {
    this.logger.log('Lấy tất cả khoa và môn học');
    return this.documentsService.getAllFacultiesAndSubjectsAndDocumentTypes();
  }

  @Get('faculty/:id')
  @ApiOperation({ summary: 'Lấy tài liệu theo khoa (name, count, documents)' })
  @ApiParam({ name: 'id', required: true, description: 'Faculty ID' })
  @ApiOkResponse({ description: 'Faculty documents', type: Object })
  async getDocumentsByFaculty(@Param('id') id: string, @Req() req) {
    return this.documentsService.getDocumentsByFaculty(id, (req as any).user.userId);
  }

  @Get('subject/:id')
  @ApiOperation({ summary: 'Lấy tài liệu theo môn học (name, count, documents)' })
  @ApiParam({ name: 'id', required: true, description: 'Subject ID' })
  @ApiOkResponse({ description: 'Subject documents', type: Object })
  async getDocumentsBySubject(@Param('id') id: string, @Req() req) {
    return this.documentsService.getDocumentsBySubject(id, (req as any).user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Trả về thông tin chi tiết của một tài liệu' })
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

  @Get(':userId/documents')
  @ApiResponseSwaggerWrapper(DocumentResponseDto, { status: 200, isArray: true })
  @ApiOperation({ summary: 'Lấy danh sách tài liệu của người dùng đã follow' })
  async getUserDocuments(
    @Param('userId') userId: string,
    @Query('limit') limit: number,
    @Query('page') page: number
  ): Promise<DocumentResponseDto[]> {
    return this.documentsService.getDocumentsByUserId(userId, limit, page);
  }
}
