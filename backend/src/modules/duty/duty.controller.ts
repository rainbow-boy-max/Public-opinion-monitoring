import { Controller, Get, UseGuards } from '@nestjs/common';
import { DutyService } from './duty.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('duty')
@UseGuards(JwtAuthGuard)
export class DutyController {
  constructor(private dutyService: DutyService) {}

  @Get('overview')
  async getOverview() {
    return this.dutyService.getOverview();
  }
}
