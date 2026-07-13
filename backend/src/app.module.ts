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
import { VerifyModule } from './modules/verify/verify.module';
import { SystemLogsModule } from './modules/system-logs/system-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
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
    VerifyModule,
    SystemLogsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
