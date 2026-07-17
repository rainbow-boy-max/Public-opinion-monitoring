import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { BullQueueModule } from './bull-queue/bull-queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { MonitorTasksModule } from './modules/monitor-tasks/monitor-tasks.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { CollectorModule } from './modules/collector/collector.module';
import { SmsModule } from './modules/sms/sms.module';
import { SmsTemplatesModule } from './modules/sms/sms-templates.module';
import { VerifyModule } from './modules/verify/verify.module';
import { SystemLogsModule } from './modules/system-logs/system-logs.module';
import { AgentsModule } from './modules/agents/agents.module';
import { KnowledgeBasesModule } from './modules/knowledge/knowledge-bases.module';
import { HotTopicsModule } from './modules/hot-topics/hot-topics.module';
import { AlertModule } from './modules/alert/alert.module';
import { CompetitorModule } from './modules/competitor/competitor.module';
import { ComparisonModule } from './modules/comparison/comparison.module';
import { PropagationModule } from './modules/propagation/propagation.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { KeywordSuggestModule } from './modules/keywords/keyword-suggest.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExportModule } from './modules/export/export.module';
import { ShortVideoModule } from './modules/short-video/short-video.module';
import { SentimentModule } from './modules/sentiment/sentiment.module';
import { TtsModule } from './modules/tts/tts.module';
import { WorkOrdersModule } from './modules/work-orders/work-order.module';
import { BrandReputationModule } from './modules/brand-reputation/brand-reputation.module';
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UploadModule } from './modules/upload/upload.module';
import { KolModule } from './modules/kol/kol.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { EcommerceModule } from './modules/ecommerce/ecommerce.module';
import { DutyModule } from './modules/dashboard/duty.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { ReportTemplatesModule } from './modules/report-templates/report-template.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(__dirname, '..', '.env')],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 60 },
    ]),
    DatabaseModule,
    RedisModule,
    BullQueueModule,
    AuthModule,
    UsersModule,
    AdminModule,
    MonitorTasksModule,
    WebhooksModule,
    RealtimeModule,
    CollectorModule,
    SmsModule,
    SmsTemplatesModule,
    VerifyModule,
    SystemLogsModule,
    AgentsModule,
    KnowledgeBasesModule,
    HotTopicsModule,
    AlertModule,
    ComparisonModule,
    PropagationModule,
    TimelineModule,
    CompetitorModule,
    KeywordSuggestModule,
    AuditModule,
    DashboardModule,
    ExportModule,
    ShortVideoModule,
    SentimentModule,
    TtsModule,
    WorkOrdersModule,
    BrandReputationModule,
    KnowledgeGraphModule,
    TenantModule,
    UploadModule,
    ReportTemplatesModule,
    KolModule,
    OcrModule,
    EcommerceModule,
    DutyModule,
    ApiKeyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
