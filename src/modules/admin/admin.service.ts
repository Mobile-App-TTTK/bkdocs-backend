import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { Status } from '@common/enums/status.enum';
import { BanStatus } from '@modules/users/enums/ban-status.enum';
import { S3Service } from '@modules/s3/s3.service';
import { AdminMemberDto } from './dtos/admin-member.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly s3Service: S3Service,
  ) {}

  async getStatistics(): Promise<{
    totalUsers: number;
    pendingDocuments: number;
  }> {
    const [totalUsers, pendingDocuments] = await Promise.all([
      this.userRepository.count(),
      this.documentRepository.count({
        where: { status: Status.PENDING },
      }),
    ]);

    return {
      totalUsers,
      pendingDocuments,
    };
  }

  async getAdminMembers(): Promise<AdminMemberDto[]> {
    // Truy vấn tối ưu, chỉ lấy các trường cần thiết
    const users = await this.userRepository.find({
      relations: ['followers', 'documents'],
      select: ['id', 'name', 'imageKey', 'banStatus'],
    });

    // Map users và lấy presigned URL cho avatar từ S3
    return Promise.all(
      users.map(async (user: any) => {
        const imageUrl = user.imageKey
          ? await this.s3Service.getPresignedDownloadUrl(user.imageKey)
          : undefined;

        return {
          id: user.id,
          name: user.name,
          imageUrl,
          isBanned: user.banStatus === BanStatus.BANNED,
          followerCount: user.followers?.length ?? 0,
          uploadedDocumentsCount: user.documents?.length ?? 0,
        };
      })
    );
  }

  async updateUserBanStatus(
    currentUserId: string,
    targetUserId: string,
    banStatus: BanStatus
  ): Promise<{ id: string; name: string; banStatus: BanStatus }> {
    // Ngăn admin tự ban chính mình
    if (currentUserId === targetUserId && banStatus === BanStatus.BANNED) {
      throw new BadRequestException('Bạn không thể ban chính bản thân mình');
    }

    // Validate ban status
    if (!Object.values(BanStatus).includes(banStatus)) {
      throw new BadRequestException('Invalid ban status');
    }

    // Tìm user cần cập nhật
    const user = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cập nhật ban status
    user.banStatus = banStatus;
    const updatedUser = await this.userRepository.save(user);

    // Trả về response đã sanitized
    return {
      id: updatedUser.id,
      name: updatedUser.name,
      banStatus: updatedUser.banStatus,
    };
  }
}
