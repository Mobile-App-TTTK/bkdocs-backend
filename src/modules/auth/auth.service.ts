import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@modules/users/user.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';
import { PasswordReset } from './entities/password_resets.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private cfg: ConfigService,
    private mailer: MailerService,
    @InjectRepository(PasswordReset)
    private prRepo: Repository<PasswordReset>,
  ) {
    this.OTP_TTL_MIN       = this.getNum('OTP_TTL_MIN', 5);
    this.TOKEN_TTL_MIN     = this.getNum('RESET_TOKEN_TTL_MIN', 15);
    this.OTP_MAX_ATTEMPTS  = this.getNum('OTP_MAX_ATTEMPTS', 5);
    this.OTP_COOLDOWN_SEC  = this.getNum('OTP_COOLDOWN_SEC', 120);
    this.BCRYPT_ROUNDS     = this.getNum('BCRYPT_SALT_ROUNDS', 10);
  }

  private OTP_TTL_MIN!: number;
  private TOKEN_TTL_MIN!: number;
  private OTP_MAX_ATTEMPTS!: number;
  private OTP_COOLDOWN_SEC!: number;
  private BCRYPT_ROUNDS!: number;

  private getNum(key: string, def: number): number {
    const v = this.cfg.get<string>(key) ?? process.env[key];
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  async requestRegisterOtp(email: string) {
    const exists = await this.usersService.findByEmail(email);
    if (exists) {
      throw new BadRequestException('Email is already registered');
    }

    let rec = await this.prRepo.findOne({ where: { purpose: 'register', email } });
    const now = new Date();

    if (rec?.lastOtpSentAt) {
      const diffSec = Math.floor((now.getTime() - rec.lastOtpSentAt.getTime()) / 1000);
      if (diffSec < this.OTP_COOLDOWN_SEC) {
        throw new BadRequestException(`Please wait ${this.OTP_COOLDOWN_SEC - diffSec}s before requesting another OTP.`);
      }
    }

    const otp = this.genOtp4();
    const otpHash = await bcrypt.hash(otp, this.BCRYPT_ROUNDS);
    const expiresAt = new Date(now.getTime() + this.OTP_TTL_MIN * 60 * 1000);

    if (!rec) {
      rec = this.prRepo.create({
        userId: null,
        email,
        purpose: 'register',
        otpHash,
        expiresAt,
        attempts: 0,
        lastOtpSentAt: now,
        tokenHash: null,
        tokenExpiresAt: null,
      });
    } else {
      rec.otpHash = otpHash;
      rec.expiresAt = expiresAt;
      rec.attempts = 0;
      rec.lastOtpSentAt = now;
      rec.tokenHash = null;
      rec.tokenExpiresAt = null;
    }
    await this.prRepo.save(rec);

    await this.mailer.sendMail({
      to: email,
      subject: 'Your registration OTP',
      text: `Your OTP code is: ${otp}\nIt will expire in ${this.OTP_TTL_MIN} minutes.`,
      html: `<p>Your OTP code is:</p>
              <p><b style="font-size:20px; letter-spacing:3px;">${otp}</b></p>
              <p>This code will expire in <b>${this.OTP_TTL_MIN} minutes</b>.</p>`,
    });

    return { message: 'An OTP has been sent to your email.' };
  }

  async registerComplete(name: string, email: string, password: string, token: string) {
    const exists = await this.usersService.findByEmail(email);
    if (exists) throw new BadRequestException('Email is already registered');

    const rec = await this.prRepo.findOne({
      where: { purpose: 'register', email },
      order: { createdAt: 'DESC' },
    });
    if (!rec || !rec.tokenHash || !rec.tokenExpiresAt) {
      throw new ForbiddenException('Invalid or missing token');
    }
    if (rec.tokenExpiresAt < new Date()) {
      throw new ForbiddenException('Token expired');
    }

    const ok = await bcrypt.compare(token, rec.tokenHash);
    if (!ok) throw new ForbiddenException('Invalid token');

    const user = await this.usersService.create(name, email, password);

    await this.prRepo.delete(rec.id);

    return { message: 'Registered successfully', user: { id: user.id, email: user.email } };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  private genOtp4(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private genResetToken(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  async forgot(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User does not exist');

    let rec = await this.prRepo.findOne({ where: { userId: user.id } });
    const now = new Date();

    if (rec?.lastOtpSentAt) {
      const diffSec = Math.floor((now.getTime() - rec.lastOtpSentAt.getTime()) / 1000);
      if (diffSec < this.OTP_COOLDOWN_SEC) {
        throw new BadRequestException(`Please wait ${this.OTP_COOLDOWN_SEC - diffSec}s before requesting another OTP.`);
      }
    }

    const otp = this.genOtp4();
    const otpHash = await bcrypt.hash(otp, Number(process.env.BCRYPT_SALT_ROUNDS || 10));
    const expiresAt = new Date(now.getTime() + this.OTP_TTL_MIN * 60 * 1000);

    if (!rec) {
      rec = this.prRepo.create({
        userId: user.id,
        otpHash,
        purpose: 'reset',
        expiresAt,
        attempts: 0,
        lastOtpSentAt: now,
        tokenHash: null,
        tokenExpiresAt: null,
      });
    } else {
      rec.otpHash = otpHash;
      rec.expiresAt = expiresAt;
      rec.attempts = 0;
      rec.lastOtpSentAt = now;
      rec.tokenHash = null;
      rec.tokenExpiresAt = null;
    }
    await this.prRepo.save(rec);

    await this.mailer.sendMail({
      to: email,
      subject: 'Your password reset OTP',
      text: `Your OTP code is: ${otp}\nIt will expire in ${this.OTP_TTL_MIN} minutes.`,
      html: `<p>Your OTP code is:</p>
              <p><b style="font-size:20px; letter-spacing:3px;">${otp}</b></p>
              <p>This code will expire in <b>${this.OTP_TTL_MIN} minutes</b>.</p>`,
    });

    return { message: 'An OTP has been sent to your email.' };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.usersService.findByEmail(email);

    let rec: PasswordReset | null = null;
    if (user) {
      rec = await this.prRepo.findOne({ where: { purpose: 'reset', userId: user.id } });
    } else {
      rec = await this.prRepo.findOne({ where: { purpose: 'register', email } });
    }

    if (!rec || !rec.otpHash) throw new BadRequestException('OTP not found');

    const now = new Date();
    if (rec.expiresAt < now) throw new ForbiddenException('OTP expired');
    if (rec.attempts >= this.OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Please request a new OTP.');
    }

    const ok = await bcrypt.compare(otp, rec.otpHash);
    if (!ok) {
      rec.attempts += 1;
      await this.prRepo.save(rec);
      throw new ForbiddenException('Invalid OTP');
    }

    const token = this.genResetToken();
    const tokenHash = await bcrypt.hash(token, this.BCRYPT_ROUNDS);
    const tokenExpiresAt = new Date(now.getTime() + this.TOKEN_TTL_MIN * 60 * 1000);

    rec.tokenHash = tokenHash;
    rec.tokenExpiresAt = tokenExpiresAt;

    rec.otpHash = null;
    rec.expiresAt = now;
    rec.attempts = 0;

    await this.prRepo.save(rec);

    return { token, expiresInMinutes: this.TOKEN_TTL_MIN };
  }

  async changePassword(token: string, newPassword: string) {
    const candidates = await this.prRepo.createQueryBuilder('pr')
      .where('pr.token_hash IS NOT NULL')
      .andWhere('pr.token_expires_at > NOW()')
      .orderBy('pr.created_at', 'DESC')
      .getMany();

    let matched: PasswordReset | null = null;
    for (const rec of candidates) {
      if (rec.tokenHash && await bcrypt.compare(token, rec.tokenHash)) {
        matched = rec; break;
      }
    }

    if (!matched) throw new ForbiddenException('Invalid or expired token');

    const user = await this.usersService.findById((matched.userId as any));
    if (!user) throw new NotFoundException('User not found');

    const hash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_SALT_ROUNDS || 10));
    await this.usersService.changePassword(user.id, { password: hash });

    await this.prRepo.delete(matched.id);

    return { message: 'Password has been reset successfully' };
  }
}