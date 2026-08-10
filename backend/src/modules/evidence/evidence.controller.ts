import { Controller, Post, Get, Param, UseGuards, Body, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BlockchainEvidenceService } from './blockchain-evidence.service';

@Controller('evidence')
@UseGuards(JwtAuthGuard)
export class EvidenceController {
  constructor(private readonly evidence: BlockchainEvidenceService) {}

  @Post('create/:eventId')
  async createEvidence(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body('reason') reason?: string,
  ) {
    return this.evidence.createEvidence(eventId, reason);
  }

  @Get('chain/:eventId')
  async getChain(@Param('eventId', ParseIntPipe) eventId: number) {
    const chain = await this.evidence.getChain(eventId);
    if (!chain) return { message: 'No evidence chain found for this event' };
    return chain;
  }

  @Get('verify/:eventId')
  async verifyChain(@Param('eventId', ParseIntPipe) eventId: number) {
    const valid = this.evidence.verifyChain(eventId);
    return { eventId, valid, hash: this.evidence.getEvidenceHash(eventId) };
  }
}