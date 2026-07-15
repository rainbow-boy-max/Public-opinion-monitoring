import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AlertController } from './alert.controller';
import { AlertRuleService } from './alert-rule.service';
import { AlertCheckerService } from './alert-checker.service';
import {
  AlertRuleEntity,
  AlertLogEntity,
  OpinionEventEntity,
} from '../../database/entities';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertRuleEntity, AlertLogEntity, OpinionEventEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
    WebhooksModule,
  ],
  controllers: [AlertController],
  providers: [AlertRuleService, AlertCheckerService],
  exports: [AlertRuleService, AlertCheckerService],
})
export class AlertModule {}
