import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ArchiveService } from './archive.service';
import { ArchiveController } from './archive.controller';
import { OpinionEventEntity, AuditEventEntity } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpinionEventEntity, AuditEventEntity]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ArchiveController],
  providers: [ArchiveService],
  exports: [ArchiveService],
})
export class ArchiveModule {}