import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '@modules/users/user.module';
import { JwtStrategy } from '@common/strategy/jwt.strategy';

import { MailerModule } from '@nestjs-modules/mailer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordReset } from './entities/password_resets.entity';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([PasswordReset]),
    JwtModule.registerAsync({
      imports: [ConfigModule],  // cần import ConfigModule
      inject: [ConfigService],  // inject ConfigService
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET') || 'my-secret';
        return {
          secret,
          signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES') || '24h' },
        };
      },
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {    
        return {
          transport: {
            host: cfg.get('SMTP_HOST'),
            port: Number(cfg.get('SMTP_PORT') ?? 587),
            secure: cfg.get('SMTP_SECURE') === 'true',
            auth: { user: cfg.get('SMTP_USER'), pass: cfg.get('SMTP_PASS') },
          },
          defaults: { from: cfg.get('MAIL_FROM') ?? 'no-reply@example.com' },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
