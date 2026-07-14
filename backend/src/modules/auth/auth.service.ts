import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserEntity, UserRole, AuthStatus } from '../../database/entities';
import { RedisService } from '../../redis/redis.service';
import { SmsService } from '../sms/sms.service';
import { throwBusiness } from '../../common/errors/business.exception';

interface LoginResult {
  token: string;
  user: { id: number; username: string; role: string; authStatus: string };
  passwordChangeRequired?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MIN = 15;

  constructor(
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    private jwtService: JwtService,
    private redisService: RedisService,
    private smsService: SmsService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) {
      throwBusiness('AUTH_INVALID_CREDENTIALS', { username });
    }

    if (user.authStatus === AuthStatus.BANNED) {
      throwBusiness('AUTH_USER_DISABLED', { username });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throwBusiness('AUTH_USER_LOCKED', { minutesLeft: minutes });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await this.recordFailedLogin(user);
      const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - user.loginAttempts;
      if (remainingAttempts > 0) {
        throwBusiness('AUTH_INVALID_CREDENTIALS', {
          username,
          remainingAttempts,
        });
      }
      throwBusiness('AUTH_USER_LOCKED', { minutesLeft: this.LOCK_DURATION_MIN });
    }

    user.loginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const token = await this.issueToken(user);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        authStatus: user.authStatus,
      },
      passwordChangeRequired: user.firstLogin === 1,
    };
  }

  private async recordFailedLogin(user: UserEntity): Promise<void> {
    user.loginAttempts += 1;
    if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + this.LOCK_DURATION_MIN * 60 * 1000);
      this.logger.warn(
        `User ${user.username} locked due to ${this.MAX_LOGIN_ATTEMPTS} failed attempts`,
      );
    }
    await this.userRepo.save(user);
  }

  private async issueToken(user: UserEntity): Promise<string> {
    const jti = randomBytes(16).toString('hex');
    return this.jwtService.sign({
      sub: user.id,
      role: user.role,
      jti,
    });
  }

  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throwBusiness('USER_NOT_FOUND', { userId });

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      throwBusiness('AUTH_INVALID_CREDENTIALS', { scene: 'change_password' });
    }
    if (newPassword.length < 6) {
      throwBusiness('PASSWORD_TOO_WEAK', { length: newPassword.length });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.firstLogin = 0;
    await this.userRepo.save(user);
  }

  async sendSmsCode(phone: string, scene: 'login' | 'register' | 'reset'): Promise<void> {
    const rateKey = `rate:sms:${phone}`;
    const count = parseInt((await this.redisService.get(rateKey)) || '0', 10);
    if (count >= 5) {
      throwBusiness('RATE_LIMITED', { scene, waitMinutes: 60 });
    }

    const existing = await this.userRepo.findOne({ where: { phone } });
    if (scene === 'register' && existing) {
      throwBusiness('USER_ALREADY_EXISTS', { phone, field: 'phone' });
    }
    if (scene !== 'register' && !existing) {
      throwBusiness('USER_NOT_FOUND', { phone, scene });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisService.set(`sms:code:${phone}:${scene}`, code, 300);
    await this.redisService.incr(rateKey);
    await this.redisService.expire(rateKey, 3600);

    await this.smsService.sendVerificationCode(phone, code, scene);
  }

  async register(
    phone: string,
    password: string,
    code: string,
    username: string,
  ): Promise<LoginResult> {
    await this.verifySmsCode(phone, 'register', code);

    const exists = await this.userRepo.findOne({
      where: [{ username }, { phone }],
    });
    if (exists) {
      throwBusiness('USER_ALREADY_EXISTS', { username, phone });
    }
    if (password.length < 6) {
      throwBusiness('PASSWORD_TOO_WEAK', { length: password.length });
    }

    const user = this.userRepo.create({
      username,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.USER,
      authStatus: AuthStatus.UNVERIFIED,
      firstLogin: 0,
      loginAttempts: 0,
    });
    await this.userRepo.save(user);

    const token = await this.issueToken(user);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        authStatus: user.authStatus,
      },
    };
  }

  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    await this.verifySmsCode(phone, 'reset', code);
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) throwBusiness('USER_NOT_FOUND', { phone });

    if (newPassword.length < 6) {
      throwBusiness('PASSWORD_TOO_WEAK', { length: newPassword.length });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);
  }

  async verifySmsCode(phone: string, scene: string, code: string): Promise<void> {
    const stored = await this.redisService.get(`sms:code:${phone}:${scene}`);
    if (!stored || stored !== code) {
      throwBusiness('AUTH_VERIFY_CODE_INVALID', { phone, scene });
    }
    await this.redisService.del(`sms:code:${phone}:${scene}`);
  }

  async logout(jti: string): Promise<void> {
    await this.redisService.set(`blacklist:jti:${jti}`, '1', 7 * 24 * 3600);
  }

  async refreshToken(userId: number, oldJti: string): Promise<{ token: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throwBusiness('USER_NOT_FOUND', { userId });
    if (user.authStatus === AuthStatus.BANNED) {
      throwBusiness('AUTH_USER_DISABLED', { userId });
    }
    await this.redisService.set(`blacklist:jti:${oldJti}`, '1', 7 * 24 * 3600);
    const token = await this.issueToken(user);
    return { token };
  }
}
