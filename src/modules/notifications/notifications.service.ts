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

  /**
   * Gửi notification cho uploader khi document được approve
   */
  async sendDocumentApprovedNotification(
    documentId: string,
    uploaderId: string,
    docName: string,
    facultyNames?: string[],
    subjectName?: string
  ) {
    const uploader = await this.userRepository.findOne({ where: { id: uploaderId } });
    if (!uploader) {
      console.warn(`Uploader ${uploaderId} not found`);
      return;
    }

    // Tạo message
    const messageParts: string[] = ['✅ Tài liệu của bạn đã được duyệt:'];
    
    if (subjectName) {
      messageParts.push(`[${subjectName}]`);
    }
    if (facultyNames?.length) {
      messageParts.push(`[${facultyNames.join(', ')}]`);
    }
    
    messageParts.push(`"${docName}"`);

    const fullMessage = messageParts.join(' ');

    // Lưu notification
    const notification = this.notificationRepository.create({
      user: uploader,
      message: fullMessage,
      type: NotificationType.DOCUMENT_APPROVED,
      targetId: documentId,
      isRead: false,
    });

    const savedNotification = await this.notificationRepository.save(notification);
    console.log(`✅ Sent approval notification to uploader ${uploader.email}`);

    // Gửi FCM nếu có token
    if (uploader.fcmToken) {
      const pushTitle = '✅ Tài liệu đã được duyệt';
      const pushBody = subjectName 
        ? `${docName} - ${subjectName}` 
        : docName;

      await this.firebaseService.sendToDevice(uploader.fcmToken, pushTitle, pushBody, {
        type: NotificationType.DOCUMENT_APPROVED,
        targetId: documentId,
        notificationId: savedNotification.id,
        documentName: docName,
        subjectName: subjectName || '',
        facultyNames: facultyNames?.join(', ') || '',
      });
    }
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

  /**
   * Hàm test để tạo nhiều thông báo mẫu cho một user
   * Dùng để test UI và chức năng notification
   * Tự động gửi FCM push notification nếu user có fcmToken
   */
  async testCreateNotifications(userId: string, count: number = 20): Promise<{ message: string; created: number; fcmSent: number }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const notificationTypes = [NotificationType.DOCUMENT, NotificationType.COMMENT, NotificationType.PROFILE];
    
    const testMessages = {
      [NotificationType.DOCUMENT]: [
        '[Công nghệ phần mềm] Tài liệu mới: "Bài giảng OOP - Lập trình hướng đối tượng" - Đăng bởi Nguyễn Văn A',
        '[Toán cao cấp] Tài liệu mới: "Giải tích 1 - Chương 3: Tích phân" - Đăng bởi Trần Thị B',
        '[Cơ sở dữ liệu] Tài liệu mới: "Database Design - ERD và Normalization" - Đăng bởi Lê Văn C',
        '[Mạng máy tính] Tài liệu mới: "Giao thức TCP/IP và OSI Model" - Đăng bởi Phạm Thị D',
        '[Trí tuệ nhân tạo] Tài liệu mới: "Machine Learning cơ bản" - Đăng bởi Hoàng Văn E',
        '[Lập trình Web] Tài liệu mới: "React Hooks và State Management" - Đăng bởi Vũ Thị F',
        '[Hệ điều hành] Tài liệu mới: "Process và Thread trong Linux" - Đăng bởi Đặng Văn G',
      ],
      [NotificationType.COMMENT]: [
        'Nguyễn Văn A đã bình luận về tài liệu "Lập trình C++ nâng cao" của bạn',
        'Trần Thị B đã trả lời bình luận của bạn trong "Giải tích 2"',
        'Lê Văn C đã thích bình luận của bạn',
        'Phạm Thị D đã nhắc đến bạn trong một bình luận',
        'Hoàng Văn E đã bình luận: "Tài liệu rất hữu ích, cảm ơn bạn!"',
      ],
      [NotificationType.PROFILE]: [
        'Nguyễn Văn A đã bắt đầu theo dõi bạn',
        'Trần Thị B và 5 người khác đã theo dõi bạn',
        'Tài liệu của bạn đã đạt 100 lượt tải xuống!',
        'Bạn đã nhận được 10 điểm đánh giá 5 sao',
        'Chúc mừng! Bạn đã trở thành thành viên nổi bật trong tuần',
      ],
    };

    // Titles cho FCM notification theo loại
    const fcmTitles = {
      [NotificationType.DOCUMENT]: '📚 Tài liệu mới',
      [NotificationType.COMMENT]: '💬 Bình luận mới',
      [NotificationType.PROFILE]: '👤 Thông báo cá nhân',
    };

    const notifications: Notification[] = [];
    let fcmSentCount = 0;
    
    for (let i = 0; i < count; i++) {
      // Chọn ngẫu nhiên loại notification
      const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
      
      // Chọn ngẫu nhiên message từ danh sách tương ứng
      const messages = testMessages[type];
      const message = messages[Math.floor(Math.random() * messages.length)];
      
      // Tạo targetId giả (UUID ngẫu nhiên)
      const targetId = `test-${type}-${Date.now()}-${i}`;
      
      // Random isRead status (70% chưa đọc, 30% đã đọc)
      const isRead = Math.random() > 0.7;
      
      const notification = this.notificationRepository.create({
        user,
        message,
        type,
        targetId,
        isRead,
      });
      
      notifications.push(notification);
    }

    // Lưu tất cả notifications vào database
    const savedNotifications = await this.notificationRepository.save(notifications);

    // Gửi FCM push notification cho từng thông báo nếu user có fcmToken
    if (user.fcmToken) {
      console.log(`🔔 Bắt đầu gửi ${savedNotifications.length} FCM notifications...`);
      
      for (const notification of savedNotifications) {
        try {
          // Tạo title và body cho FCM
          const fcmTitle = fcmTitles[notification.type as NotificationType] || '🔔 Thông báo mới';
          const fcmBody = notification.message;

          // Gửi FCM notification
          const success = await this.firebaseService.sendToDevice(
            user.fcmToken,
            fcmTitle,
            fcmBody,
            {
              type: notification.type,
              targetId: notification.targetId,
              notificationId: notification.id,
              isTest: 'true', // Đánh dấu đây là notification test
            }
          );

          if (success) {
            fcmSentCount++;
          }

          // Delay nhỏ giữa các lần gửi để tránh spam (100ms)
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Lỗi khi gửi FCM cho notification ${notification.id}:`, error.message);
        }
      }

      console.log(`✅ Đã gửi thành công ${fcmSentCount}/${savedNotifications.length} FCM notifications`);
    } else {
      console.log('⚠️ User không có FCM token, bỏ qua việc gửi push notifications');
    }

    return { 
      message: `Đã tạo thành công ${count} thông báo test cho user ${user.name || user.email}${user.fcmToken ? ` và gửi ${fcmSentCount} FCM notifications` : ''}`,
      created: notifications.length,
      fcmSent: fcmSentCount
    };
  }
}
