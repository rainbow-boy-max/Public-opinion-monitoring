import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertConfigEntity } from '../../database/entities/alert-config.entity';
import { AlertRecordEntity } from '../../database/entities/alert-record.entity';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { AlertConfigService } from './alert-config.service';
import { AlertRecordService } from './alert-record.service';
import { AlertLevelEvaluator } from './alert-level-evaluator';
import { AlertNotificationService } from './alert-notification.service';
import { AlertAdvancedController } from './alert-advanced.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertConfigEntity,
      AlertRecordEntity,
      OpinionEventEntity,
    ]),
  ],
  controllers: [AlertAdvancedController],
  providers: [
    AlertConfigService,
    AlertRecordService,
    AlertLevelEvaluator,
    AlertNotificationService,
  ],
  exports: [
    AlertConfigService,
    AlertRecordService,
    AlertLevelEvaluator,
    AlertNotificationService,
  ],
})
export class AlertAdvancedModule {}
