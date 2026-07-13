import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
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
    HttpModule,
  ],
  controllers: [WebhooksController, WebhookIngestController],
  providers: [WebhooksService, PayloadTemplateService, WebhookPusherService],
  exports: [WebhooksService, WebhookPusherService],
})
export class WebhooksModule {}
