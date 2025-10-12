import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { Document } from '@modules/documents/entities/document.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Một môn học có thể có nhiều tài liệu */
  @OneToMany(() => Document, (document) => document.subject)
  documents: Document[];

  /** Nhiều người dùng có thể theo dõi nhiều môn học */
  @ManyToMany(() => User, (user) => user.subscribedSubjects)
  subscribers: User[];
}
