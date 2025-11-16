import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiErrorResponseSwaggerWrapper } from '@common/decorators/api-error-response-swagger-wapper.decorator';
import { DocumentResponseDto } from '@modules/documents/dtos/responses/document.response.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentsService } from '@modules/documents/documents.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/role.guard';
import { Roles } from '@common/decorators/role.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { Status } from '@common/enums/status.enum';
import { User } from '@modules/users/entities/user.entity';
import { UsersService } from '@modules/users/user.service';
import { GetUserProfileResponseDto } from '@modules/users/dtos/responses/getUserProfile.response.dto';
import { Subject } from '@modules/documents/entities/subject.entity';
@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly userService: UsersService
  ) {}

  @Get('users')
  async getAllUsers(): Promise<GetUserProfileResponseDto[]> {
    return this.userService.getAllUsers();
  }

  @ApiOperation({ summary: 'Duyệt tài liệu đang pending → active và gửi broadcast' })
  @Patch('document/:id/status')
  @ApiOkResponse({ description: 'Đã duyệt tài liệu thành công' })
  @ApiErrorResponseSwaggerWrapper()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(Status), example: 'ACTIVE' },
      },
    },
  })
  async approveDocument(
    @Param('id') docId: string,
    @Body('status') status: Status
  ): Promise<{ message: string }> {
    const document = await this.documentsService.updateDocumentStatus(docId, status);

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

  @Post('subject')
  @ApiOperation({ summary: 'Tạo môn học mới' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        name: { type: 'string', example: 'Giải Tích 1' },
        description: { type: 'string', example: 'Môn học về Giải Tích 1' },
      },
    },
  })
  @ApiOkResponse({ description: 'Created subject', type: Subject })
  async createSubject(
    @UploadedFile() image: Express.Multer.File,
    @Body('name') name: string,
    @Body('description') description: string
  ): Promise<Subject> {
    return this.documentsService.createSubject(name, description, image);
  }

  @Patch('/users/:userId/role-admin')
  @ApiOperation({ summary: 'Nâng cấp người dùng thành admin' })
  @ApiOkResponse({ description: 'User upgraded to admin', type: User })
  async upgradeUserToAdmin(@Param('userId') userId: string): Promise<User> {
    return this.userService.upgradeUserRole(userId, UserRole.ADMIN);
  }

  // để api path là danh từ thôi
  @Patch('user/:userId/verification')
  @ApiOperation({ summary: 'Cho người dùng tick xanh' })
  @ApiOkResponse({ description: 'User verified', type: User })
  async toggleVerifyUser(@Param('userId') userId: string): Promise<User> {
    return this.userService.toggleVerifyUser(userId);
  }
}
