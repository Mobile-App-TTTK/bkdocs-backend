import { Controller, Get } from '@nestjs/common';
import { User } from './entities/user.entity';
import { UsersService } from './user.service';
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// Guards
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/role.decorator';
import { UserRole } from '@common/enums/user-role.enums';
import { RolesGuard } from '@common/guards/role.guard';
@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
    constructor(private userService: UsersService) {}

    @Get()
    async getAllUsers(): Promise<User[]> {
        return this.userService.getAllUsers();
    }
}
