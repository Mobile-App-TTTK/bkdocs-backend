import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { DocumentResponseDto } from '@modules/documents/dtos/responses/document.response.dto';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from '@modules/documents/documents.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/role.guard';
import { Roles } from '@common/decorators/role.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { Status } from '@common/enums/status.enum';
@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly documentsService: DocumentsService
  ) {}

  @ApiOperation({ summary: 'Duyệt tài liệu đang pending → active và gửi broadcast' })
  @Patch('document:id/approve')
  async approveDocument(@Param('id') docId: string) {
    const document = await this.documentsService.updateDocumentStatus(docId, Status.ACTIVE);

    return {
      message: `Đã duyệt tài liệu ${document.title}.`,
    };
  }

  @Get('documents/pending')
  @ApiOperation({ summary: 'Lấy danh sách tài liệu đang chờ duyệt (có phân trang)' })
  @ApiQuery({
    name: 'page',
    example: 1,
    required: false,
    description: 'Trang hiện tại (mặc định = 1)',
  })
  @ApiQuery({
    name: 'limit',
    example: 10,
    required: false,
    description: 'Số lượng tài liệu mỗi trang (mặc định = 10)',
  })
  @ApiQuery({
    name: 'fullTextSearch',
    example: 'Giai Tich',
    required: false,
    description: 'Từ khóa tìm kiếm toàn văn trong tiêu đề tài liệu',
  })
  @ApiOkResponse({
    description: 'Danh sách tài liệu đang chờ duyệt',
    type: DocumentResponseDto,
    isArray: true,
  })
  @ApiErrorResponseSwaggerWrapper()
  async getPendingDocuments(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('fullTextSearch') fullTextSearch?: string
  ): Promise<{ data: DocumentResponseDto[]; total: number; page: number; totalPages: number }> {
    return this.documentsService.getPendingDocuments(page, limit, fullTextSearch);
  }
}
