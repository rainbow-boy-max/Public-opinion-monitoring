import { Controller, Get, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('overview')
  overview() {
    return this.service.getOverview();
  }

  @Get('recent-activities')
  recentActivities(@Query('limit') limit = 20) {
    return this.service.getRecentActivities(Number(limit) || 20);
  }

  @Sse('recent-activities/stream')
  stream(): Observable<{ data: any; type?: string }> {
    return this.service.streamRecentActivities();
  }
}
