import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { MiniMaxProvider } from './providers/minimax.provider';
import { XiaomiProvider } from './providers/xiaomi.provider';
import { PrReportEntity, TtsConfigEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([PrReportEntity, TtsConfigEntity])],
  controllers: [TtsController],
  providers: [TtsService, MiniMaxProvider, XiaomiProvider],
  exports: [TtsService],
})
export class TtsModule {}
