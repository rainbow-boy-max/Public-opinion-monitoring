import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { MiniMaxProvider } from './providers/minimax.provider';
import { XiaomiProvider } from './providers/xiaomi.provider';
import { PrReportEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrReportEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [TtsController],
  providers: [TtsService, MiniMaxProvider, XiaomiProvider],
  exports: [TtsService],
})
export class TtsModule {}
