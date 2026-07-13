import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SmsLogEntity, AliyunConfigEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([SmsLogEntity, AliyunConfigEntity])],
  providers: [SmsService],
  controllers: [SmsController],
  exports: [SmsService],
})
export class SmsModule {}
