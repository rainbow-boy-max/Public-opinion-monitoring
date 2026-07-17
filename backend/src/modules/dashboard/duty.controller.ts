import { Controller, Get, UseGuards } from '@nestjs/common';
import { DutyService } from './duty.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('duty')
@UseGuards(JwtAuthGuard)
export class DutyController {
  constructor(private readonly dutyService: DutyService) {}

  @Get('overview')
  async getOverview(@CurrentUser() user: CurrentUserPayload) {
    return this.dutyService.getDutyOverview(user.id);
  }
}
