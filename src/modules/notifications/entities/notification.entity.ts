import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { NotificationType } from '@common/enums/notification-type.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  message: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.DOCUMENT,
  })
  type: string;

  @Column({ name: 'target_id', nullable: true })
  targetId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
