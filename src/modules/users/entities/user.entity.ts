import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { UserRole } from '@common/enums/user-role.enum';
import { Notification } from '@modules/notifications/entities/notification.entity';
import { Document } from '@modules/documents/entities/document.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { Faculty } from '@modules/documents/entities/faculty.entity';
import { Rating } from '@modules/ratings/entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
import { PasswordReset } from '@modules/auth/entities/password_resets.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ name: 'image_key', nullable: true })
  imageKey: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STUDENT,
  })
  role: UserRole;

  @Column({ name: 'intake_year', type: 'int', nullable: true })
  intakeYear: number | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Document, (document) => document.uploader)
  documents: Document[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @ManyToMany(() => Subject, (subject) => subject.subscribers)
  @JoinTable({ name: 'subject_subscriptions' })
  subscribedSubjects: Subject[];

  @ManyToMany(() => User, (user) => user.followers)
  @JoinTable({
    name: 'user_followers',
    joinColumn: { name: 'follower_id' }, // người theo dõi
    inverseJoinColumn: { name: 'following_id' }, // người bị theo dõi
  })
  following: User[];

  /** những ai đang theo dõi user này */
  @ManyToMany(() => User, (user) => user.following)
  followers: User[];

  @ManyToMany(() => Faculty, (faculty) => faculty.subscribers)
  @JoinTable({ name: 'faculty_subscriptions' })
  subscribedFaculties: Faculty[];

  @OneToMany(() => Rating, (rating) => rating.user)
  ratings: Rating[];

  @OneToMany(() => Comment, (comment) => comment.document)
  comments: Comment[];

  @OneToOne(() => PasswordReset, (passwordReset) => passwordReset.userId)
  passwordReset: PasswordReset;

  @ManyToOne(() => Faculty, (faculty) => faculty.users)
  @JoinColumn({ name: 'faculty_id' })
  faculty: Faculty;
}
