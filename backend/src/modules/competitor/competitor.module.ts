import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CompetitorController } from './competitor.controller';
import { CompetitorService } from './competitor.service';
import {
  CompetitorGroupEntity,
  OpinionEventEntity,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompetitorGroupEntity, OpinionEventEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [CompetitorController],
  providers: [CompetitorService],
  exports: [CompetitorService],
})
export class CompetitorModule {}
