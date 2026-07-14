import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AliyunConfigEntity,
  UserEntity,
  SystemLogEntity,
  AuditEventEntity,
  LlmModelEntity,
  AgentEntity,
  MonitorTaskEntity,
  OpinionEventEntity,
} from '../../database/entities';
import { AdminController } from './admin.controller';
import {
  AliyunConfigService,
  UserManagementService,
} from './services';
import { VerifyRealnameService } from '../verify/verify-realname.service';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { SmsModule } from '../sms/sms.module';
import { WebSearchModule } from './web-search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AliyunConfigEntity,
      UserEntity,
      SystemLogEntity,
      AuditEventEntity,
      LlmModelEntity,
      AgentEntity,
      MonitorTaskEntity,
      OpinionEventEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
    SystemLogsModule,
    SmsModule,
    WebSearchModule,
  ],
  controllers: [AdminController, AuditController, DashboardController],
  providers: [
    AliyunConfigService,
    UserManagementService,
    VerifyRealnameService,
    AuditService,
    DashboardService,
  ],
  exports: [
    AliyunConfigService,
    UserManagementService,
    VerifyRealnameService,
    AuditService,
    DashboardService,
  ],
})
export class AdminModule {}
