import { Body, Controller, Get, Patch, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { User } from './entities/user.entity';
import { UsersService } from './user.service';
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
// Guards
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/role.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { RolesGuard } from '@common/guards/role.guard';

import { FileInterceptor } from '@nestjs/platform-express';
import { GetUserProfileResponseDto } from './dtos/responses/getUserProfile.response.dto';
import { UpdateUserProfileDto } from './dtos/requests/updateUserProfile.dto';
import { ApiResponseSwaggerWrapper } from '@common/decorators/api-response-swagger-wapper.decorator';
@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  @Roles(UserRole.ADMIN)
  @Get()
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

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
        yearOfStudy: { type: 'number', example: 3 },
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
    @Body('yearOfStudy') yearOfStudy?: number,
    @UploadedFile() avatar?: Express.Multer.File
  ): Promise<GetUserProfileResponseDto> {
    const dto = new UpdateUserProfileDto({ name, facultyId, yearOfStudy });
    return this.userService.updateProfile(req.user.userId, dto, avatar);
  }
}
