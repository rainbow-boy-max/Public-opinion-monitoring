import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerifyController } from './verify.controller';
import { VerifyService } from './verify.service';
import { UserEntity, AliyunConfigEntity, SystemLogEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AliyunConfigEntity, SystemLogEntity])],
  controllers: [VerifyController],
  providers: [VerifyService],
  exports: [VerifyService],
})
export class VerifyModule {}
