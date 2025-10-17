import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Notification } from './entities/notification.entity';
import {
  GetUserNotificationsResponseDto,
  UserNotificationDto,
} from './dtos/response/getUserNotifications.response.dto';
import { Faculty } from '@modules/documents/entities/falcuty.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { NotificationType } from '@common/enums/notification-type.enum';
import { NotificationsGateway } from './notifications.gateway';
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
    private readonly gateway: NotificationsGateway
  ) {}
  async getUserNotifications(userId: string): Promise<GetUserNotificationsResponseDto> {
    const user: User | null = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const notifications: Notification[] = await this.notificationRepository.find({
      where: { user: { id: userId } },
    });
    const NotificationDto: UserNotificationDto[] = notifications.map(
      (notification) => new UserNotificationDto(notification)
    );
    return new GetUserNotificationsResponseDto(NotificationDto);
  }

  async sendNewDocumentNotification(
    documentId: string,
    facultyId: string | undefined,
    subjectId: string | undefined,
    docName: string
  ) {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.subscribedFaculties', 'faculty')
      .leftJoinAndSelect('user.subscribedSubjects', 'subject')
      .where('faculty.id = :facultyId OR subject.id = :subjectId', { facultyId, subjectId })
      .getMany();

    users.map(async (user) => {
      const notification = this.notificationRepository.create({
        user,
        message: `Tài liệu mới "${docName}" đã được thêm vào`,
        type: NotificationType.DOCUMENT,
        targetId: documentId,
        isRead: false,
      });
      const notificationSave = await this.notificationRepository.save(notification);
      this.gateway.sendNotification(user.id, notificationSave);
    });
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
}
