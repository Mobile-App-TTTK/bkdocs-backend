import {
  Body,
  Controller,
  forwardRef,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { User } from './entities/user.entity';
import { UsersService } from './user.service';
import { UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
// Guards
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/role.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { RolesGuard } from '@common/guards/role.guard';

import { FileInterceptor } from '@nestjs/platform-express';
import { GetUserProfileResponseDto } from './dtos/responses/getUserProfile.response.dto';
import { UpdateUserProfileDto } from './dtos/requests/updateUserProfile.dto';
import { ApiResponseSwaggerWrapper } from '@common/decorators/api-response-swagger-wapper.decorator';
import { DocumentResponseDto } from '@modules/documents/dtos/responses/document.response.dto';
import { DocumentsService } from '@modules/documents/documents.service';
import { FollowedAndSubscribedListResponseDto } from './dtos/responses/followedAndSubscribedList.response.dto';
@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private userService: UsersService,
    @Inject(forwardRef(() => DocumentsService))
    private readonly documentsService: DocumentsService
  ) {}

  @Get('profile')
  @ApiResponseSwaggerWrapper(GetUserProfileResponseDto)
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại (kèm URL avatar từ S3)' })
  async getProfile(@Req() req: any): Promise<GetUserProfileResponseDto> {
    console.log('User ID from request:', req.user.userId);
    return this.userService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @ApiResponseSwaggerWrapper(GetUserProfileResponseDto)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({ summary: 'Cập nhật hồ sơ người dùng và upload avatar lên S3' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        facultyId: { type: 'string', example: '4e5fe7ad-5163-4278-8592-8a89e67a17c5' },
        intakeYear: { type: 'number', example: 2022 },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh đại diện (file upload)',
        },
      },
    },
  })
  // file data will be available in 'avatar' field
  async updateProfile(
    @Req() req: any,
    @Body('name') name?: string,
    @Body('facultyId') facultyId?: string,
    @Body('intakeYear') intakeYear?: number,
    @UploadedFile() avatar?: Express.Multer.File
  ): Promise<GetUserProfileResponseDto> {
    const dto = new UpdateUserProfileDto({ name, facultyId, intakeYear: intakeYear });
    return this.userService.updateProfile(req.user.userId, dto, avatar);
  }

  @Get(':userId/profile')
  @ApiResponseSwaggerWrapper(GetUserProfileResponseDto)
  @ApiOperation({ summary: 'Lấy thông tin người dùng (kèm URL avatar từ S3)' })
  async getUserProfile(@Param('userId') userId: string): Promise<GetUserProfileResponseDto> {
    return this.userService.getProfile(userId);
  }

  // Phân trang
  @Get(':userId/documents')
  @ApiResponseSwaggerWrapper(DocumentResponseDto, { status: 200, isArray: true })
  @ApiOperation({ summary: 'Lấy danh sách tài liệu của người dùng' })
  async getUserDocuments(
    @Param('userId') userId: string,
    @Query('limit') limit: number,
    @Query('page') page: number
  ): Promise<DocumentResponseDto[]> {
    return this.documentsService.getDocumentsByUserId(userId, limit, page);
  }

  @Post(':userId/toggle-follow')
  @ApiOperation({ summary: 'Theo dõi hoặc bỏ theo dõi người dùng khác' })
  async toggleFollowUser(@Req() req: any, @Param('userId') userIdToFollow: string): Promise<void> {
    return this.userService.toggleFollowUser(req.user.userId, userIdToFollow);
  }

  @Get('following-and-subscribing-list')
  async getFollowingAndSubscribingList(
    @Req() req: any
  ): Promise<FollowedAndSubscribedListResponseDto[]> {
    return await this.userService.getFollowingAndSubscribingList(req.user.userId);
  }
}
