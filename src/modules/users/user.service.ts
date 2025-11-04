import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { GetUserProfileResponseDto } from './dtos/responses/getUserProfile.response.dto';
import { UpdateUserProfileDto } from './dtos/requests/updateUserProfile.dto';
import { S3Service } from '@modules/s3/s3.service';
import { FollowResponseDto } from './dtos/responses/follow.response.dto';
import { Faculty } from '@modules/documents/entities/faculty.entity';
import { DocumentsService } from '@modules/documents/documents.service';
import { FollowedAndSubscribedListResponseDto } from './dtos/responses/followedAndSubscribedList.response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
    private readonly s3Service: S3Service,
    private readonly dataSource: DataSource,
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
      relations: ['faculty', 'documents'],
    });
    if (!user) throw new NotFoundException('User not found');
    console.log('user: ', user);

    const imageUrl: string | undefined = user.imageKey
      ? await this.s3Service.getPresignedDownloadUrl(user.imageKey)
      : undefined;

    // tính số lượng tài liệu đã upload bởi user này
    return new GetUserProfileResponseDto({
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: imageUrl,
      faculty: user.faculty ? user.faculty.name : undefined,
      intakeYear: user.intakeYear ? user.intakeYear : undefined,
      documentCount: user.documents ? user.documents.length : 0,
      numberFollowers: user.followers ? user.followers.length : 0,
      participationDays: user.createdAt
        ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      role: user.role,
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
    if (dto.intakeYear) user.intakeYear = dto.intakeYear;
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
      intakeYear: user.intakeYear ? user.intakeYear : undefined,
    });
  }

  private async ensureUserExists(userId: string) {
    const exists = await this.usersRepo.exist({ where: { id: userId } });
    if (!exists) throw new NotFoundException(`User ${userId} not found`);
  }

  async FollowUser(currentUserId: string, targetUserId: string): Promise<FollowResponseDto> {
    if (!currentUserId) throw new BadRequestException('Missing current user');
    if (currentUserId === targetUserId) throw new BadRequestException('Không thể theo dõi chính mình');
    await this.ensureUserExists(targetUserId);

    const [existsRow] = await this.dataSource.query(
      `
      SELECT EXISTS(
        SELECT 1
        FROM user_followers
        WHERE "following_id" = $1 AND "follower_id" = $2
      ) AS "isFollowing"
      `,
      [targetUserId, currentUserId],
    );
    const isFollowingNow = Boolean(existsRow?.isFollowing);

    let action: 'followed' | 'unfollowed' | 'noop';

    if (isFollowingNow) {
      const delRes = await this.dataSource.query(
        `
        DELETE FROM user_followers
        WHERE "following_id" = $1 AND "follower_id" = $2
        RETURNING 1 AS removed
        `,
        [targetUserId, currentUserId],
      );
      action = (Array.isArray(delRes) && delRes.length > 0) ? 'unfollowed' : 'noop';
    } else {
      const insRes = await this.dataSource.query(
        `
        INSERT INTO user_followers ("following_id","follower_id")
        VALUES ($1,$2)
        ON CONFLICT ("following_id","follower_id") DO NOTHING
        RETURNING 1 AS inserted
        `,
        [targetUserId, currentUserId],
      );
      action = (Array.isArray(insRes) && insRes.length > 0) ? 'followed' : 'noop';
    }

    const [existsRow2] = await this.dataSource.query(
      `
      SELECT EXISTS(
        SELECT 1
        FROM user_followers
        WHERE "following_id" = $1 AND "follower_id" = $2
      ) AS "isFollowing"
      `,
      [targetUserId, currentUserId],
    );

    const [countRow] = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS "followersCount"
      FROM user_followers
      WHERE "following_id" = $1
      `,
      [targetUserId],
    );

    return new FollowResponseDto({
      action,
      isFollowing: Boolean(existsRow2?.isFollowing),
      followersCount: Number(countRow?.followersCount ?? 0),
    });
  }
  
  async toggleFollowUser(followerId: string, userIdToFollow: string): Promise<void> {
    if (followerId === userIdToFollow) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const follower = await this.usersRepo.findOne({
      where: { id: followerId },
      relations: ['following'],
    });
    if (!follower) throw new NotFoundException('Follower user not found');

    const userToFollow = await this.usersRepo.findOne({ where: { id: userIdToFollow } });
    if (!userToFollow) throw new NotFoundException('User to follow not found');

    // Kiểm tra nếu đã theo dõi rồi
    const isAlreadyFollowing = follower.following.some((u) => u.id === userIdToFollow);
    if (isAlreadyFollowing) {
      // Nếu đã theo dõi, bỏ theo dõi
      follower.following = follower.following.filter((u) => u.id !== userIdToFollow);
    } else {
      // Nếu chưa theo dõi, thêm theo dõi
      follower.following.push(userToFollow);
    }

    await this.usersRepo.save(follower);
  }

  async getFollowingAndSubscribingList(
    userId: string
  ): Promise<FollowedAndSubscribedListResponseDto[]> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['subscribedSubjects', 'following', 'subscribedFaculties'],
    });

    if (!user) throw new NotFoundException('User not found');
    return [
      new FollowedAndSubscribedListResponseDto({
        followingUsers: user.following.map((u) => ({
          id: u.id,
          name: u.name,
          documentCount: u.documents ? u.documents.length : 0,
        })),
        subscribedFacultyIds: user.subscribedFaculties.map((f) => ({
          id: f.id,
          name: f.name,
          documentCount: f.documents ? f.documents.length : 0,
        })),
        subscribedSubjectIds: user.subscribedSubjects.map((s) => ({
          id: s.id,
          name: s.name,
          documentCount: s.documents ? s.documents.length : 0,
        })),
      }),
    ];
  }
}
