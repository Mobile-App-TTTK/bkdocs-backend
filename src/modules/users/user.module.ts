import { Module } from "@nestjs/common";
import { UsersService } from "./user.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersController } from './users.controller';
import { User } from "./entities/user.entity";

@Module({
    providers: [UsersService],
    exports: [UsersService],
    controllers: [UsersController],
    imports: [TypeOrmModule.forFeature([User])],
})
export class UsersModule {}