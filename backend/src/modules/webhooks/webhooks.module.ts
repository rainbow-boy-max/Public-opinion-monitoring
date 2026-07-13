import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebhooksController } from './webhooks.controller';
import { WebhookIngestController } from './webhook-ingest.controller';
import { WebhooksService } from './webhooks.service';
import { PayloadTemplateService } from './payload-template.service';
import { WebhookPusherService } from './webhook-pusher.service';
import {
  WebhookEntity,
  WebhookTaskBindingEntity,
  WebhookPushLogEntity,
  OpinionEventEntity,
  MonitorTaskEntity,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEntity,
      WebhookTaskBindingEntity,
      WebhookPushLogEntity,
      OpinionEventEntity,
      MonitorTaskEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [WebhooksController, WebhookIngestController],
  providers: [WebhooksService, PayloadTemplateService, WebhookPusherService],
  exports: [WebhooksService, WebhookPusherService],
})
export class WebhooksModule {}
