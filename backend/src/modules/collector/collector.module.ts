import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { CollectorService } from './collector.service';
import { CollectorProcessor } from './collector.processor';
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
import { MockAdapter } from './adapters/mock.adapter';
import {
  MonitorTaskEntity,
  OpinionEventEntity,
} from '../../database/entities';

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
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  providers: [
    CollectorService,
    CollectorProcessor,
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
    MockAdapter,
  ],
  exports: [CollectorService, KeywordMatcherService, AdapterRegistry],
})
export class CollectorModule {}
