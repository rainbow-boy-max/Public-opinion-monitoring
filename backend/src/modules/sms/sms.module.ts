import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { SmsLogEntity, AliyunConfigEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([SmsLogEntity, AliyunConfigEntity])],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
