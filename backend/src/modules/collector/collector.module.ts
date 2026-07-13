import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { CollectorService } from './collector.service';
import { KeywordMatcherService } from './keyword-matcher.service';
import { OpinionNormalizerService } from './opinion-normalizer.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { WeiboAdapter } from './adapters/weibo.adapter';
import { WeixinAdapter } from './adapters/weixin.adapter';
import { DouyinAdapter } from './adapters/douyin.adapter';
import { XiaohongshuAdapter } from './adapters/xiaohongshu.adapter';
import { KuaishouAdapter } from './adapters/kuaishou.adapter';
import { BaijiahaoAdapter } from './adapters/baijiahao.adapter';
import { WeixinVideoAdapter } from './adapters/weixin-video.adapter';
import {
  MonitorTaskEntity,
  OpinionEventEntity,
} from '../../database/entities';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonitorTaskEntity, OpinionEventEntity]),
    BullModule.registerQueue({
      name: 'task-queue',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 1,
      },
    }),
    WebhooksModule,
    RealtimeModule,
  ],
  providers: [
    CollectorService,
    KeywordMatcherService,
    OpinionNormalizerService,
    AdapterRegistry,
    WeiboAdapter,
    WeixinAdapter,
    DouyinAdapter,
    XiaohongshuAdapter,
    KuaishouAdapter,
    BaijiahaoAdapter,
    WeixinVideoAdapter,
  ],
  exports: [CollectorService, KeywordMatcherService],
})
export class CollectorModule {}
