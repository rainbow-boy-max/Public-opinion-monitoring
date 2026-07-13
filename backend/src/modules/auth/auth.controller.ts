import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

interface LoginResult {
  token: string;
  user: any;
  passwordChangeRequired?: boolean;
}

class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string;
}

class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username: string;

  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid Chinese phone number' })
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

class SendSmsDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid Chinese phone number' })
  phone: string;

  @IsString()
  scene: 'login' | 'register' | 'reset';
}

class ResetPasswordDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  newPassword: string;
}

class ChangePasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  newPassword: string;
}

class RefreshTokenDto {
  @IsString()
  oldJti: string;
}

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<LoginResult> {
    return this.authService.register(dto.phone, dto.password, dto.code, dto.username);
  }

  @Post('send-sms-code')
  @HttpCode(HttpStatus.OK)
  async sendSmsCode(@Body() dto: SendSmsDto) {
    await this.authService.sendSmsCode(dto.phone, dto.scene);
    return { message: 'Verification code sent' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.phone, dto.code, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto.oldPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @CurrentUser() user: { id: number; jti: string },
    @Body() _dto: RefreshTokenDto,
  ) {
    return this.authService.refreshToken(user.id, user.jti);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('jti') jti: string) {
    await this.authService.logout(jti);
    return { message: 'Logged out successfully' };
  }
}
