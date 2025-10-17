import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { Faculty } from '@modules/documents/entities/falcuty.entity';
import { Rating } from '@modules/ratings/entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
import { Image } from '@modules/documents/entities/image.entity';
import { Status } from '@common/enums/status.enum';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'file_key' })
  fileKey: string;

  @Column({ name: 'thumbnail_key', nullable: true })
  thumbnailKey: string;

  @Column({ name: 'download_count', default: 0 })
  downloadCount: number;

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.PENDING,
    comment: 'Trạng thái của tài liệu',
  })
  status: string;

  @CreateDateColumn({ name: 'upload_date' })
  uploadDate: Date;

  /** Người đăng tài liệu */
  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploader_id' })
  uploader: User;

  /** Môn học mà tài liệu thuộc về */
  @ManyToOne(() => Subject, (subject) => subject.documents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  /** Khoa mà tài liệu thuộc về */
  @ManyToOne(() => Faculty, (faculty) => faculty.documents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'faculty_id' })
  faculty: Faculty;

  @OneToMany(() => Rating, (rating) => rating.document)
  ratings: Rating[];

  @OneToMany(() => Comment, (comment) => comment.document)
  comments: Comment[];

  @OneToMany(() => Image, (image) => image.document)
  images: Image[];
}
