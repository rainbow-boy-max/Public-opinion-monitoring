import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PropagationController } from './propagation.controller';
import { PropagationService } from './propagation.service';
import { PropagationLinkEntity, OpinionEventEntity, MonitorTaskEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropagationLinkEntity, OpinionEventEntity, MonitorTaskEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [PropagationController],
  providers: [PropagationService],
  exports: [PropagationService],
})
export class PropagationModule {}
