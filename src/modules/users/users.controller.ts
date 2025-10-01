import { Controller, Get } from '@nestjs/common';
import { User } from './entities/user.entity';
import { UsersService } from './user.service';
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// Guards
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
@ApiTags('users')
@ApiBearerAuth('JWT-auth') // 👈 trùng với tên schema ở trên
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(private userService: UsersService) {}

    @Get()
    async getAllUsers(): Promise<User[]> {
        return this.userService.getAllUsers();
    }
}
