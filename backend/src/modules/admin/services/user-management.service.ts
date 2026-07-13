import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, AuthStatus, UserRole } from '../../../database/entities';
import { RedisService } from '../../../redis/redis.service';
import { SmsService } from '../../sms/sms.service';

@Injectable()
export class UserManagementService {
  constructor(
    @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>,
    private redisService: RedisService,
    private smsService: SmsService,
  ) {}

  async listUsers(params: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: Partial<UserEntity>[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, search, status, startDate, endDate } = params;
    const qb = this.userRepo.createQueryBuilder('u').where('u.role = :role', { role: UserRole.USER });

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
    void operatorId;
  }
}
