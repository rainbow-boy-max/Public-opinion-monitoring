import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthStatus, UserEntity, UserRole } from './database/entities/user.entity';

@Injectable()
export class InitialAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitialAdminBootstrapService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const initialPassword = this.configService.get<string>('INIT_ADMIN_PASSWORD');
    if (!initialPassword) {
      this.logger.warn('INIT_ADMIN_PASSWORD 未配置，跳过初始管理员创建');
      return;
    }

    const existingAdmin = await this.userRepo.findOne({ where: { username: 'admin' } });
    if (existingAdmin) {
      this.logger.log('管理员账户已存在，跳过初始管理员创建');
      return;
    }

    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const admin = this.userRepo.create({
      username: 'admin',
      passwordHash,
      phone: '0000000000',
      role: UserRole.ADMIN,
      authStatus: AuthStatus.VERIFIED,
      firstLogin: 1,
      loginAttempts: 0,
    });

    await this.userRepo.save(admin);
    this.logger.log('初始管理员账户已创建，首次登录后将强制修改密码');
  }
}
