import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import {
  AliyunConfigService,
  UserManagementService,
} from './services';
import { AliyunConfigEntity, UserEntity, SystemLogEntity } from '../../database/entities';
import { SmsModule } from '../sms/sms.module';
import { VerifyRealnameService } from '../verify/verify-realname.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AliyunConfigEntity, UserEntity, SystemLogEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
    SmsModule,
  ],
  controllers: [AdminController],
  providers: [AliyunConfigService, UserManagementService, VerifyRealnameService],
  exports: [AliyunConfigService, UserManagementService, VerifyRealnameService],
})
export class AdminModule {}
