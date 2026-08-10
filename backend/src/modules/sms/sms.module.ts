import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SmsLogEntity, AliyunConfigEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([SmsLogEntity, AliyunConfigEntity])],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
