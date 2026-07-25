import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortVideoConfigEntity } from '../../database/entities/short-video-config.entity';
import { AliyunVideoConfigEntity } from '../../database/entities/aliyun-video-config.entity';
import { ShortVideoConfigService } from './short-video-config.service';
import { ShortVideoConfigController } from './short-video-config.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShortVideoConfigEntity,
      AliyunVideoConfigEntity,
    ]),
  ],
  controllers: [ShortVideoConfigController],
  providers: [ShortVideoConfigService],
  exports: [ShortVideoConfigService],
})
export class ShortVideoConfigModule {}
