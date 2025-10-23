import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { GetUserProfileResponseDto } from './dtos/responses/getUserProfile.response.dto';
import { UpdateUserProfileDto } from './dtos/requests/updateUserProfile.dto';
import { S3Service } from '@modules/s3/s3.service';
import { Faculty } from '@modules/documents/entities/falcuty.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
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
    console.log('user: ', user);

    const imageUrl: string | undefined = user.imageKey
      ? await this.s3Service.getPresignedDownloadUrl(user.imageKey)
      : undefined;
    return new GetUserProfileResponseDto({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      imageUrl: imageUrl,
      faculty: user.faculty ? user.faculty.name : undefined,
      yearOfStudy: user.yearOfStudy ? user.yearOfStudy : undefined,
    });
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserProfileDto,
    avatarFile?: Express.Multer.File
  ): Promise<GetUserProfileResponseDto> {
    const user: User | null = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['faculty'],
    });
    if (!user) throw new NotFoundException('User not found');
    // Cập nhật tên hoặc avatar
    if (dto.name) user.name = dto.name;
    if (dto.facultyId && dto.facultyId !== user.faculty?.id) {
      const newFaculty = await this.facultyRepo.findOne({ where: { id: dto.facultyId } });
      if (!newFaculty) throw new NotFoundException('Faculty not found');
      user.faculty = newFaculty;
    }
    if (dto.yearOfStudy) user.yearOfStudy = dto.yearOfStudy;
    // Nếu có avatar mới → upload S3
    if (avatarFile) {
      const fileKey: string = await this.s3Service.uploadFile(avatarFile, 'avatars');
      user.imageKey = fileKey;
    }

    const updated: User = await this.usersRepo.save(user);
    console.log('user: ', user);
    const imageUrl: string | undefined = updated.imageKey
      ? await this.s3Service.getPresignedDownloadUrl(updated.imageKey)
      : undefined;
    return new GetUserProfileResponseDto({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      imageUrl: imageUrl,
      faculty: user.faculty ? user.faculty.name : undefined,
      yearOfStudy: user.yearOfStudy ? user.yearOfStudy : undefined,
    });
  }
}
