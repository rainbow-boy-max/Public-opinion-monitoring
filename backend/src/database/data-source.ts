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
import { AuditEventEntity } from './entities/audit-event.entity';
import { WebSearchConfigEntity } from './entities/web-search-config.entity';
import { AgentEntity, LlmModelEntity, AgentKbFileEntity, AgentKbChunkEntity, PrReportEntity, UserDeletedEntity } from './entities/agent.entity';
import { KnowledgeBaseEntity, KnowledgeBaseFileEntity, KnowledgeBaseChunkEntity, AgentKnowledgeBindingEntity } from './entities/knowledge-base.entity';

const entities = [
  UserEntity,
  AliyunConfigEntity,
  MonitorTaskEntity,
  OpinionEventEntity,
  WebhookEntity,
  WebhookTaskBindingEntity,
  WebhookPushLogEntity,
  SmsLogEntity,
  SystemLogEntity,
  AuditEventEntity,
  WebSearchConfigEntity,
  LlmModelEntity,
  AgentEntity,
  AgentKbFileEntity,
  AgentKbChunkEntity,
  PrReportEntity,
  UserDeletedEntity,
  KnowledgeBaseEntity,
  KnowledgeBaseFileEntity,
  KnowledgeBaseChunkEntity,
  AgentKnowledgeBindingEntity,
];

const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase();

const commonOptions: any = {
  entities,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  timezone: '+08:00',
  charset: 'utf8mb4',
};

let driverOptions: any;

if (dbType === 'sqlite') {
  driverOptions = {
    type: 'better-sqlite3',
    database: process.env.DB_DATABASE_FILE || '/data/app.db',
    synchronize: true,
    ...commonOptions,
  };
} else {
  driverOptions = {
    type: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'opinion_monitor',
    synchronize: process.env.DB_SYNC === 'true',
    ...commonOptions,
  };
}

export const AppDataSource = new DataSource(driverOptions);
