import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import {
  AliyunConfigService,
  UserManagementService,
} from './services';
import { AliyunConfigEntity, UserEntity, SystemLogEntity } from '../../database/entities';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AliyunConfigEntity, UserEntity, SystemLogEntity]),
    SmsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AliyunConfigService, UserManagementService],
  exports: [AliyunConfigService, UserManagementService],
})
export class AdminModule {}
