import { Body, Controller, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '@modules/auth/dtos/requests/create-user.dto';
import { LoginUserDto } from '@modules/auth/dtos/requests/login-user.dto';
import { ForgotPasswordDto } from '@modules/auth/dtos/requests/forgot-password.dto';
import { VerifyOtpDto } from '@modules/auth/dtos/requests/verify-otp.dto';
import { ChangePasswordDto } from '@modules/auth/dtos/requests/change-password.dto';
import { RegisterRequestOtpDto } from '@modules/auth/dtos/requests/register-request-otp.dto';
import { RegisterCompleteDto } from '@modules/auth/dtos/requests/register-complete.dto';
import { ApiBody } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiBody({ type: RegisterRequestOtpDto })
  @Post('otp')
  async requestRegisterOtp(@Body() dto: RegisterRequestOtpDto) {
    return this.authService.requestRegisterOtp(dto.email);
  }

  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @Post('register')
  async registerComplete(@Body() dto: RegisterCompleteDto) {
    return this.authService.registerComplete(dto.name, dto.email, dto.password, dto.token);
  }

  @Post('login')
  async login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('password-reset')
  async forgot(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgot(dto.email);
  }

  @Patch('password')
  async changePassword(@Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(dto.token, dto.newPassword);
  }
}
