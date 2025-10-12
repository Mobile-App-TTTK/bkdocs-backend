import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '@modules/users/entities/user.entity';
import { Document } from '@modules/documents/entities/document.entity';

@Entity('ratings')
@Unique(['user', 'document'])
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('float', { default: 1 , comment: 'Score từ 1 đến 5'} )
  score: number;

  @CreateDateColumn()
  createdAt: Date;

  /** Người đánh giá */
  @ManyToOne(() => User, (user) => user.ratings, { onDelete: 'CASCADE' })
  user: User;

  /** Tài liệu được đánh giá */
  @ManyToOne(() => Document, (document) => document.ratings, { onDelete: 'CASCADE' })
  document: Document;
}
