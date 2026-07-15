import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpinionEventEntity, MonitorTaskEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
