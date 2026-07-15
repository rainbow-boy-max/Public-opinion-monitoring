import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortVideoController } from './short-video.controller';
import { ShortVideoService } from './short-video.service';
import { ShortVideoEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([ShortVideoEntity])],
  controllers: [ShortVideoController],
  providers: [ShortVideoService],
  exports: [ShortVideoService],
})
export class ShortVideoModule {}
