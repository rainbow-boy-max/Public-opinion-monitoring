import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainEvidenceService } from './blockchain-evidence.service';
import { EvidenceController } from './evidence.controller';
import { OpinionEventEntity } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([OpinionEventEntity])],
  controllers: [EvidenceController],
  providers: [BlockchainEvidenceService],
  exports: [BlockchainEvidenceService],
})
export class EvidenceModule {}