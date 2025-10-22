import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { Document } from '@modules/documents/entities/document.entity';
import { User } from '@modules/users/entities/user.entity';
import { FacultyYearSubject } from '@modules/documents/entities/faculty-year-subject.entity';

@Entity('faculties')
export class Faculty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Một khoa có thể có nhiều tài liệu */
  @OneToMany(() => Document, (document) => document.faculty)
  documents: Document[];

  /** Nhiều người dùng có thể theo dõi nhiều khoa */
  @ManyToMany(() => User, (user) => user.subscribedFaculties)
  subscribers: User[];

  @OneToMany(() => User, (user) => user.faculty)
  users: User[];

  @OneToMany(() => FacultyYearSubject, (c) => c.faculty)
  curricula: FacultyYearSubject[];
}
