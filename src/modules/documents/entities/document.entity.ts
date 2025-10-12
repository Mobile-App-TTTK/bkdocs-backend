import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Subject } from '@modules/documents/entities/subject.entity';
import { Faculty } from '@modules/documents/entities/falcuty.entity';
import { Rating } from '@modules/ratings/entities/rating.entity';
import { Comment } from '@modules/comments/entities/comment.entity';
@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  fileUrl: string;

  @Column({ default: 0 })
  downloadCount: number;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  uploadDate: Date;

  /** Người đăng tài liệu */
  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  uploader: User;

  /** Môn học mà tài liệu thuộc về */
  @ManyToOne(() => Subject, (subject) => subject.documents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  subject: Subject;

  /** Khoa mà tài liệu thuộc về */
  @ManyToOne(() => Faculty, (faculty) => faculty.documents, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  faculty: Faculty;

  @OneToMany(() => Rating, (rating) => rating.document)
  ratings: Rating[];

  @OneToMany(() => Comment, (comment) => comment.document)
  comments: Comment[];

}
