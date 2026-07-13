import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { AliyunConfigEntity } from './entities/aliyun-config.entity';
import { MonitorTaskEntity } from './entities/monitor-task.entity';
import { OpinionEventEntity } from './entities/opinion-event.entity';
import { WebhookEntity } from './entities/webhook.entity';
import { WebhookTaskBindingEntity } from './entities/webhook-task-binding.entity';
import { WebhookPushLogEntity } from './entities/webhook-push-log.entity';
import { SmsLogEntity } from './entities/sms-log.entity';
import { SystemLogEntity } from './entities/system-log.entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'opinion_monitor',
  entities: [
    UserEntity,
    AliyunConfigEntity,
    MonitorTaskEntity,
    OpinionEventEntity,
    WebhookEntity,
    WebhookTaskBindingEntity,
    WebhookPushLogEntity,
    SmsLogEntity,
    SystemLogEntity,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  timezone: '+08:00',
  charset: 'utf8mb4',
});