import { Module } from '@nestjs/common';
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
  ],
  controllers: [AdminController],
  providers: [AliyunConfigService, UserManagementService],
  exports: [AliyunConfigService, UserManagementService],
})
export class AdminModule {}
