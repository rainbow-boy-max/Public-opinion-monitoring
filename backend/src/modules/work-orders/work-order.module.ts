import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkOrderController } from './work-order.controller';
import { WorkOrderService } from './work-order.service';
import {
  WorkOrderEntity,
  WorkOrderCommentEntity,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkOrderEntity, WorkOrderCommentEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'default',
      }),
    }),
  ],
  controllers: [WorkOrderController],
  providers: [WorkOrderService],
  exports: [WorkOrderService],
})
export class WorkOrdersModule {}
