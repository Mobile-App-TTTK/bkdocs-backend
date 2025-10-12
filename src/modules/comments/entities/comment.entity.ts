import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  /** Người bình luận */
  @ManyToOne(() => User, (user) => user.comments, { onDelete: 'CASCADE' })
  user: User;

  /** Tài liệu được bình luận */
  @ManyToOne(() => Document, (document) => document.comments, { onDelete: 'CASCADE' })
  document: Document;
}
