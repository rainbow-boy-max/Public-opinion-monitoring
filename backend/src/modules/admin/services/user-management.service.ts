import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, AuthStatus, UserRole } from '../../../database/entities';
import { RedisService } from '../../../redis/redis.service';
import { SmsService } from '../../sms/sms.service';
import { AuditService } from '../audit.service';

@Injectable()
export class UserManagementService {
  constructor(
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    private redisService: RedisService,
    private smsService: SmsService,
    private auditService: AuditService,
  ) {}

  async listUsers(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    role?: string;
  }): Promise<{ items: Partial<UserEntity>[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, search, status, startDate, endDate, role } = params;
    const qb = this.userRepo.createQueryBuilder('u');
    if (!role) {
      qb.where('u.role = :role', { role: UserRole.USER });
    } else {
      qb.where('u.role = :role', { role });
    }

    if (search) {
      qb.andWhere('(u.username LIKE :q OR u.phone LIKE :q)', { q: `%${search}%` });
    }
    if (status) {
      qb.andWhere('u.auth_status = :status', { status });
    }
    if (startDate) {
      qb.andWhere('u.created_at >= :start', { start: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('u.created_at <= :end', { end: new Date(endDate) });
    }

    qb.orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((u) => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        realName: u.realName,
        authStatus: u.authStatus,
        role: u.role,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async countByRole(role?: string): Promise<number> {
    const qb = this.userRepo.createQueryBuilder('u');
    if (!role) qb.where('u.role = :role', { role: UserRole.USER });
    else qb.where('u.role = :role', { role });
    return qb.getCount();
  }

  async banUser(userId: number, operatorId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot ban administrator');
    }

    user.authStatus = AuthStatus.BANNED;
    await this.userRepo.save(user);

    await this.redisService.set(`blacklist:user:${userId}`, '1', 7 * 24 * 3600);

    try {
      await this.smsService.sendNotification(
        user.phone,
        'SMS_BAN_NOTIFY',
        { username: user.username },
        'notify',
      );
    } catch (err) {
      // SMS notification failure should not block the ban operation
    }
    await this.auditService.record({
      actorType: 'admin',
      actorId: operatorId,
      module: 'users',
      action: 'ban',
      resourceType: 'user',
      resourceId: user.id,
      title: `封禁用户：${user.username}`,
    });
    void operatorId;
  }

  async unbanUser(userId: number, operatorId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.authStatus !== AuthStatus.BANNED) {
      throw new BadRequestException('User is not banned');
    }

    user.authStatus = user.idCardHash ? AuthStatus.VERIFIED : AuthStatus.UNVERIFIED;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);

    await this.redisService.del(`blacklist:user:${userId}`);

    try {
      await this.smsService.sendNotification(
        user.phone,
        'SMS_UNBAN_NOTIFY',
        { username: user.username },
        'notify',
      );
    } catch (err) {
      // SMS notification failure should not block the unban operation
    }
    await this.auditService.record({
      actorType: 'admin',
      actorId: operatorId,
      module: 'users',
      action: 'unban',
      resourceType: 'user',
      resourceId: user.id,
      title: `解封用户：${user.username}`,
    });
    void operatorId;
  }

  async createUser(payload: {
    username: string;
    phone: string;
    password: string;
    role?: 'admin' | 'user' | 'operator';
    authStatus?: AuthStatus;
  }): Promise<any> {
    if (!payload.username || !payload.phone || !payload.password) {
      throw new BadRequestException('用户名、手机号、密码必填');
    }
    if (payload.password.length < 6) {
      throw new BadRequestException('密码至少 6 位');
    }
    const existing = await this.userRepo.findOne({
      where: [{ username: payload.username }, { phone: payload.phone }],
    });
    if (existing) {
      throw new BadRequestException('用户名或手机号已存在');
    }
    const bcryptjs = await import('bcryptjs');
    const passwordHash = bcryptjs.hashSync(payload.password, 12);
    const user = this.userRepo.create({
      username: payload.username,
      phone: payload.phone,
      passwordHash,
      role: payload.role === 'admin' ? UserRole.ADMIN : UserRole.USER,
      authStatus: payload.authStatus || AuthStatus.UNVERIFIED,
      firstLogin: 0,
      loginAttempts: 0,
    });
    const saved = await this.userRepo.save(user);
    await this.auditService.record({
      actorType: 'admin',
      module: 'users',
      action: 'create',
      resourceType: 'user',
      resourceId: saved.id,
      title: `创建用户：${saved.username}`,
    });
    return {
      id: saved.id,
      username: saved.username,
      phone: saved.phone,
      message: '用户创建成功',
      tempPassword: payload.password,
    };
  }

  async resetPassword(userId: number, operatorId: number): Promise<{ tempPassword: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let tempPassword = '';
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const bcryptjs = await import('bcryptjs');
    user.passwordHash = bcryptjs.hashSync(tempPassword, 12);
    user.firstLogin = 1;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);
    await this.auditService.record({
      actorType: 'admin',
      actorId: operatorId,
      module: 'users',
      action: 'reset-password',
      resourceType: 'user',
      resourceId: user.id,
      title: `重置用户密码：${user.username}`,
    });
    void operatorId;
    return { tempPassword };
  }

  async deleteUser(userId: number, operatorId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('不能删除管理员账号');
    }
    await this.userRepo.remove(user);

    try {
      const { UserDeletedEntity } = await import('../../../database/entities/agent.entity');
      const userDeletedRepo = (this.userRepo.manager.getRepository(UserDeletedEntity));
      await userDeletedRepo.save({
        originalUserId: user.id,
        username: user.username,
        phone: user.phone,
        deletedBy: operatorId,
      });
    } catch (err) {
      // ignore audit log error
    }
    await this.auditService.record({
      actorType: 'admin',
      actorId: operatorId,
      module: 'users',
      action: 'delete',
      resourceType: 'user',
      resourceId: user.id,
      title: `删除用户：${user.username}`,
    });
  }

  async getUserDetail(userId: number): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      username: user.username,
      phone: user.phone,
      realName: user.realName,
      idCardHash: user.idCardHash ? `${user.idCardHash.substring(0, 8)}...` : null,
      authStatus: user.authStatus,
      role: user.role,
      firstLogin: user.firstLogin === 1,
      loginAttempts: user.loginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
