import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Notification } from './entities/notification.entity';
import {
  GetUserNotificationsResponseDto,
  UserNotificationDto,
} from './dtos/response/getUserNotifications.response.dto';
import { Faculty } from '@modules/documents/entities/faculty.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { NotificationType } from '@common/enums/notification-type.enum';
import { FirebaseService } from './firebase.service';
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Faculty)
    private readonly facultyRepo: Repository<Faculty>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    private readonly firebaseService: FirebaseService
  ) {}
  async getUserNotifications(
    userId: string,
    page: number,
    limit: number
  ): Promise<GetUserNotificationsResponseDto> {
    const user: User | null = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const notificationDtos: UserNotificationDto[] = notifications.map(
      (notification) => new UserNotificationDto(notification)
    );

    return new GetUserNotificationsResponseDto({
      data: notificationDtos,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }

  async sendNewDocumentNotification(
    documentId: string,
    facultyIds: string[] | undefined,
    subjectId: string | undefined,
    docName: string,
    uploaderId?: string
  ) {
    // Set để tránh gửi duplicate notifications
    const userIdsSet = new Set<string>();

    // 1. Lấy users subscribe faculty/subject
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.subscribedFaculties', 'faculty')
      .leftJoinAndSelect('user.subscribedSubjects', 'subject');

    if (facultyIds?.length && subjectId) {
      query.where('(faculty.id IN (:...facultyIds) OR subject.id = :subjectId)', {
        facultyIds,
        subjectId,
      });
    } else if (facultyIds?.length) {
      query.where('faculty.id IN (:...facultyIds)', { facultyIds });
    } else if (subjectId) {
      query.where('subject.id = :subjectId', { subjectId });
    }

    const subscribedUsers = await query.getMany();
    subscribedUsers.forEach((user) => userIdsSet.add(user.id));

    // 2. Lấy users đã follow uploader (nếu có)
    if (uploaderId) {
      const followersQuery = this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.following', 'following')
        .where('following.id = :uploaderId', { uploaderId });

      const followers = await followersQuery.getMany();
      followers.forEach((user) => userIdsSet.add(user.id));
    }

    // 3. Loại bỏ uploader khỏi danh sách (không gửi notification cho chính mình)
    if (uploaderId) {
      userIdsSet.delete(uploaderId);
    }

    // 4. Lấy full user objects
    if (userIdsSet.size === 0) {
      return; // Không có ai để gửi
    }

    const users = await this.userRepository.findByIds(Array.from(userIdsSet));

    // 5. Lấy thông tin chi tiết về faculty, subject, uploader
    const facultyNames: string[] = [];
    if (facultyIds?.length) {
      const faculties = await this.facultyRepo.findByIds(facultyIds);
      facultyNames.push(...faculties.map((f) => f.name));
    }

    let subjectName: string | null = null;
    if (subjectId) {
      const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
      subjectName = subject?.name || null;
    }

    let uploaderName: string | null = null;
    if (uploaderId) {
      const uploader = await this.userRepository.findOne({ where: { id: uploaderId } });
      uploaderName = uploader?.name || null;
    }

    // 6. Tạo message chi tiết
    const messageParts: string[] = [];

    if (subjectName) {
      messageParts.push(`[${subjectName}]`);
    }
    if (facultyNames.length > 0) {
      messageParts.push(`[${facultyNames.join(', ')}]`);
    }

    messageParts.push(`Tài liệu mới: "${docName}"`);

    if (uploaderName) {
      messageParts.push(`- Đăng bởi ${uploaderName}`);
    }

    const fullMessage = messageParts.join(' ');
    console.log('users to notify: ', users);

    // 7. Gửi notifications
    await Promise.all(
      users.map(async (user) => {
        const notification = this.notificationRepository.create({
          user,
          message: fullMessage,
          type: NotificationType.DOCUMENT,
          targetId: documentId,
          isRead: false,
        });
        console.log('notification to save: ', notification);
        const notificationSave = await this.notificationRepository.save(notification);

        // Gửi push notification qua FCM với thông tin chi tiết
        if (user.fcmToken) {
          const pushTitle = subjectName ? `📚 ${subjectName}` : '📄 Tài liệu mới';
          const pushBody = uploaderName ? `${docName} - Đăng bởi ${uploaderName}` : docName;

          await this.firebaseService.sendToDevice(user.fcmToken, pushTitle, pushBody, {
            type: NotificationType.DOCUMENT,
            targetId: documentId,
            notificationId: notificationSave.id,
            documentName: docName,
            subjectName: subjectName || '',
            facultyNames: facultyNames.join(', '),
            uploaderName: uploaderName || '',
          });
        }
      })
    );
  }

  async markAsRead(notificationId: string) {
    const notification: Notification | null = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new BadRequestException('Notification not found');
    }
    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async subscribeFaculty(userId: string, facultyId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['subscribedFaculties'],
    });
    const faculty = await this.facultyRepo.findOneBy({ id: facultyId });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');

    const already = user.subscribedFaculties.some((f) => f.id === facultyId);
    if (already) throw new BadRequestException('Đã đăng ký theo dõi khoa này');

    user.subscribedFaculties.push(faculty);
    console.log('user after push faculty: ', user);
    await this.userRepository.save(user);

    return { message: `Đã đăng ký theo dõi khoa ${faculty.name}` };
  }

  async unsubscribeFaculty(userId: string, facultyId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['subscribedFaculties'],
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const beforeCount = user.subscribedFaculties.length;
    user.subscribedFaculties = user.subscribedFaculties.filter((f) => f.id !== facultyId);
    await this.userRepository.save(user);

    if (beforeCount === user.subscribedFaculties.length) {
      throw new BadRequestException('Người dùng chưa đăng ký khoa này');
    }

    return { message: 'Đã hủy theo dõi khoa thành công' };
  }

  async subscribeSubject(userId: string, subjectId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['subscribedSubjects'],
    });
    const subject = await this.subjectRepo.findOneBy({ id: subjectId });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (!subject) throw new NotFoundException('Không tìm thấy môn học');

    const already = user.subscribedSubjects.some((s) => s.id === subjectId);
    if (already) throw new BadRequestException('Đã đăng ký theo dõi môn học này');

    user.subscribedSubjects.push(subject);
    await this.userRepository.save(user);

    return { message: `Đã đăng ký theo dõi môn ${subject.name}` };
  }

  async unsubscribeSubject(userId: string, subjectId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['subscribedSubjects'],
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const beforeCount = user.subscribedSubjects.length;
    user.subscribedSubjects = user.subscribedSubjects.filter((s) => s.id !== subjectId);
    await this.userRepository.save(user);

    if (beforeCount === user.subscribedSubjects.length) {
      throw new BadRequestException('Người dùng chưa đăng ký môn học này');
    }

    return { message: 'Đã hủy theo dõi môn học thành công' };
  }

  /**
   * Lưu FCM token cho user
   */
  async saveFcmToken(userId: string, fcmToken: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    user.fcmToken = fcmToken;
    await this.userRepository.save(user);

    return { message: 'Đã lưu FCM token thành công' };
  }
}
