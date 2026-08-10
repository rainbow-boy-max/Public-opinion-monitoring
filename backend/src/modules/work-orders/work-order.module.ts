import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkOrderController } from './work-order.controller';
import { IncidentWorkflowController } from './incident-workflow.controller';
import { WorkOrderService } from './work-order.service';
import { IncidentWorkflowService } from './incident-workflow.service';
import {
  WorkOrderEntity,
  WorkOrderCommentEntity,
  OpinionEventEntity,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrderEntity, WorkOrderCommentEntity, OpinionEventEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [WorkOrderController, IncidentWorkflowController],
  providers: [WorkOrderService, IncidentWorkflowService],
  exports: [WorkOrderService],
})
export class WorkOrdersModule {}
