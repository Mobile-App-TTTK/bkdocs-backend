import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { GetUserProfileResponseDto } from './dtos/responses/getUserProfile.response.dto';
import { UpdateUserProfileDto } from './dtos/requests/updateUserProfile.dto';
import { S3Service } from '@modules/s3/s3.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly s3Service: S3Service
  ) {}

  async create(name: string, email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ name, email, password: hashedPassword });
    return this.usersRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async getAllUsers(): Promise<User[]> {
    return this.usersRepo.find();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async changePassword(id: string, partial: Partial<User>) {
    const ok = await this.usersRepo.update(id, partial);
    if (ok.affected === 0) throw new NotFoundException('User not found');
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByIdWithFaculty(id: string) {
    return this.usersRepo.findOne({ where: { id }, relations: ['faculty'] });
  }
  async getProfile(userId: string): Promise<GetUserProfileResponseDto> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['faculty'],
    });
    if (!user) throw new NotFoundException('User not found');

    const imageUrl: string | undefined = user.imageKey
      ? await this.s3Service.getPresignedDownloadUrl(user.imageKey)
      : undefined;
    return new GetUserProfileResponseDto({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      imageUrl: imageUrl,
      faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : undefined,
    });
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserProfileDto,
    avatarFile?: Express.Multer.File
  ): Promise<GetUserProfileResponseDto> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Cập nhật tên hoặc avatar
    if (dto.name) user.name = dto.name;

    // Nếu có avatar mới → upload S3
    if (avatarFile) {
      const fileKey: string = await this.s3Service.uploadFile(avatarFile, 'avatars');
      user.imageKey = fileKey;
    }

    const updated: User = await this.usersRepo.save(user);
    const imageUrl: string | undefined = updated.imageKey
      ? await this.s3Service.getPresignedDownloadUrl(updated.imageKey)
      : undefined;
    return new GetUserProfileResponseDto({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      imageUrl: imageUrl,
    });
  }
}
