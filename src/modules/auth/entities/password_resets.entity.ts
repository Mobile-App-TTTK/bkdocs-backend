import { User } from '@modules/users/entities/user.entity';
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  OneToOne, JoinColumn, Index
} from 'typeorm';

export type ResetPurpose = 'reset' | 'register';

@Entity('password_resets')
export class PasswordReset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Index()
  @Column({ name: 'email', nullable: true, type: 'varchar', length: 255 })
  email: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  purpose: ResetPurpose;

  @Column({ name: 'otp_hash', nullable: true, type: 'text' })
  otpHash: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'last_otp_sent_at', type: 'timestamptz', nullable: true })
  lastOtpSentAt: Date | null;

  @Index()
  @Column({ name: 'token_hash', nullable: true, type: 'text' })
  tokenHash: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne(() => User, (user) => user.passwordReset, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}