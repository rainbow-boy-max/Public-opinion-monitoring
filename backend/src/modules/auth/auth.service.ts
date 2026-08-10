import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserEntity, UserRole, AuthStatus, PasswordHistoryEntity } from '../../database/entities';
import { PasswordValidatorService } from './password-validator.service';
import { MfaService } from './mfa.service';
import { RedisService } from '../../redis/redis.service';
import { SmsService } from '../sms/sms.service';
import { throwBusiness } from '../../common/errors/business.exception';
import { AuditService } from '../admin/audit.service';

export interface LoginResult {
  token: string;
  user: { id: number; username: string; role: string; authStatus: string };
  passwordChangeRequired?: boolean;
  passwordExpired?: boolean;
  mfaRequired?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MIN = 15;

  constructor(
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    @InjectRepository(PasswordHistoryEntity) private historyRepo: Repository<PasswordHistoryEntity>,
    private passwordValidator: PasswordValidatorService,
    private mfaService: MfaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private smsService: SmsService,
    private auditService: AuditService,
  ) {}

  async login(dto: { username?: string; phone?: string; password?: string; code?: string }): Promise<LoginResult> {
    if (dto.username) {
      return this.loginByUsername(dto.username, dto.password || '');
    }
    if (dto.phone && dto.password) {
      return this.loginByPhonePassword(dto.phone, dto.password);
    }
    if (dto.phone && dto.code) {
      return this.loginByPhoneCode(dto.phone, dto.code);
    }
    throwBusiness('AUTH_INVALID_CREDENTIALS', { reason: 'missing_credentials' });
  }

  private async loginByUsername(username: string, password: string): Promise<LoginResult> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throwBusiness('AUTH_INVALID_CREDENTIALS', { username });
    if (user.authStatus === AuthStatus.BANNED) throwBusiness('AUTH_USER_DISABLED', { username });
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throwBusiness('AUTH_USER_LOCKED', { minutesLeft: minutes });
    }
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await this.recordFailedLogin(user);
      const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - user.loginAttempts;
      if (remainingAttempts > 0) {
        throwBusiness('AUTH_INVALID_CREDENTIALS', { username, remainingAttempts });
      }
      throwBusiness('AUTH_USER_LOCKED', { minutesLeft: this.LOCK_DURATION_MIN });
    }

    // 检查密码是否过期（90 天）
    const passwordExpired = this.isPasswordExpired(user);

    // P1-14: 检查 MFA 是否启用
    const mfaRequired = await this.mfaService.isMfaEnabled(user.id);

    const result = await this.finalizeLogin(user);
    return { ...result, passwordExpired, mfaRequired };
  }

  private async loginByPhonePassword(phone: string, password: string): Promise<LoginResult> {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) throwBusiness('AUTH_INVALID_CREDENTIALS', { phone });
    if (user.authStatus === AuthStatus.BANNED) throwBusiness('AUTH_USER_DISABLED', { phone });
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throwBusiness('AUTH_USER_LOCKED', { minutesLeft: minutes });
    }
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await this.recordFailedLogin(user);
      const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - user.loginAttempts;
      if (remainingAttempts > 0) {
        throwBusiness('AUTH_INVALID_CREDENTIALS', { phone, remainingAttempts });
      }
      throwBusiness('AUTH_USER_LOCKED', { minutesLeft: this.LOCK_DURATION_MIN });
    }
    return this.finalizeLogin(user);
  }

  private async loginByPhoneCode(phone: string, code: string): Promise<LoginResult> {
    await this.verifySmsCode(phone, 'login', code);
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) throwBusiness('AUTH_INVALID_CREDENTIALS', { phone });
    if (user.authStatus === AuthStatus.BANNED) throwBusiness('AUTH_USER_DISABLED', { phone });
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throwBusiness('AUTH_USER_LOCKED', { minutesLeft: minutes });
    }
    return this.finalizeLogin(user);
  }

  private async finalizeLogin(user: UserEntity): Promise<LoginResult> {
    user.loginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // P1-14: 如果 MFA 已启用，不发放 token，等待二次验证
    const mfaRequired = await this.mfaService.isMfaEnabled(user.id);
    if (mfaRequired) {
      return {
        token: '',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          authStatus: user.authStatus,
        },
        passwordChangeRequired: user.firstLogin === 1,
        mfaRequired: true,
      };
    }

    const token = await this.issueToken(user);
    await this.auditService.record({
      actorId: user.id,
      actorType: user.role === UserRole.ADMIN ? 'admin' : 'user',
      module: 'auth',
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      title: `${user.username} 登录成功`,
    });
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
    
    // P1-9: 记录登录失败审计日志
    await this.auditService.record({
      actorId: user.id,
      actorType: user.role === UserRole.ADMIN ? 'admin' : 'user',
      module: 'auth',
      action: 'login-failed',
      resourceType: 'user',
      resourceId: user.id,
      title: `登录失败：${user.username}（剩余尝试次数：${this.MAX_LOGIN_ATTEMPTS - user.loginAttempts}）`,
    });
  }

  private isPasswordExpired(user: UserEntity): boolean {
    if (!user.passwordUpdatedAt) return false;
    const daysSinceUpdate = (Date.now() - user.passwordUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 90;
  }

  private async issueToken(user: UserEntity): Promise<string> {
    const jti = randomBytes(16).toString('hex');

    // 并发会话控制：限制每个用户最多 5 个活跃会话
    const sessionKey = `user:sessions:${user.id}`;
    const sessions = await this.redisService.client.lRange(sessionKey, 0, -1);
    if (sessions.length >= 5) {
      // 移除最早的会话
      const oldest = sessions[0];
      await this.redisService.client.lPop(sessionKey);
      await this.redisService.set(`blacklist:jti:${oldest}`, '1', 7 * 24 * 3600);
    }
    await this.redisService.client.rPush(sessionKey, jti);
    await this.redisService.client.expire(sessionKey, 7 * 24 * 3600);

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

    // 校验新密码策略
    const result = this.passwordValidator.validate(newPassword);
    if (!result.valid) {
      throwBusiness('PASSWORD_TOO_WEAK', { errors: result.errors });
    }

    // 校验密码历史
    const history = await this.historyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    for (const h of history) {
      if (await bcrypt.compare(newPassword, h.passwordHash)) {
        throwBusiness('PASSWORD_HISTORY_CONFLICT');
      }
    }

    // 更新密码哈希
    await this.historyRepo.save({ userId, passwordHash: user.passwordHash });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.firstLogin = 0;
    user.passwordUpdatedAt = new Date();
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
    
    // P0-2: 统一密码策略 - 使用 PasswordValidatorService
    const passwordResult = this.passwordValidator.validate(password);
    if (!passwordResult.valid) {
      throwBusiness('PASSWORD_TOO_WEAK', { errors: passwordResult.errors });
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
    await this.auditService.record({
      actorType: 'user',
      module: 'auth',
      action: 'register',
      resourceType: 'user',
      resourceId: user.id,
      title: `新用户注册：${username}`,
    });
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

    // P0-2: 统一密码策略 - 使用 PasswordValidatorService
    const passwordResult = this.passwordValidator.validate(newPassword);
    if (!passwordResult.valid) {
      throwBusiness('PASSWORD_TOO_WEAK', { errors: passwordResult.errors });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);
  }

  async verifyMfaAndIssueToken(userId: number, mfaToken: string): Promise<LoginResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throwBusiness('USER_NOT_FOUND', { userId });

    const verified = await this.mfaService.verifyMfa(userId, mfaToken);
    if (!verified) {
      throwBusiness('AUTH_MFA_INVALID', { reason: 'invalid_mfa_token' });
    }

    const token = await this.issueToken(user);
    await this.auditService.record({
      actorId: user.id,
      actorType: user.role === UserRole.ADMIN ? 'admin' : 'user',
      module: 'auth',
      action: 'mfa-verified',
      resourceType: 'user',
      resourceId: user.id,
      title: `${user.username} MFA 验证通过`,
    });
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

  async verifySmsCode(phone: string, scene: string, code: string): Promise<void> {
    const stored = await this.redisService.get(`sms:code:${phone}:${scene}`);
    if (!stored || stored !== code) {
      throwBusiness('AUTH_VERIFY_CODE_INVALID', { phone, scene });
    }
    await this.redisService.del(`sms:code:${phone}:${scene}`);
  }

  async logout(jti: string, userId?: number): Promise<void> {
    await this.redisService.set(`blacklist:jti:${jti}`, '1', 7 * 24 * 3600);

    if (userId) {
      const sessionKey = `user:sessions:${userId}`;
      await this.redisService.client.lRem(sessionKey, 0, jti);
    }
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
