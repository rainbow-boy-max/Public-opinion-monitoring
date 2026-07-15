import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ComparisonController } from './comparison.controller';
import { ComparisonService } from './comparison.service';
import { OpinionEventEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpinionEventEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [ComparisonController],
  providers: [ComparisonService],
  exports: [ComparisonService],
})
export class ComparisonModule {}
