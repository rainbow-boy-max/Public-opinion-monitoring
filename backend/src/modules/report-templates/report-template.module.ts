import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  ReportTemplateEntity,
  OpinionEventEntity,
  MonitorTaskEntity,
  PrReportEntity,
} from '../../database/entities';
import { ReportTemplateController } from './report-template.controller';
import { ReportTemplateService } from './report-template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportTemplateEntity,
      OpinionEventEntity,
      MonitorTaskEntity,
      PrReportEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [ReportTemplateController],
  providers: [ReportTemplateService],
  exports: [ReportTemplateService],
})
export class ReportTemplatesModule implements OnModuleInit {
  constructor(private service: ReportTemplateService) {}

  async onModuleInit(): Promise<void> {
    await this.service.seedPresets();
  }
}
