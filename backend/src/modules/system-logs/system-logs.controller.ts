import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SystemLogsService } from './system-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/system-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SystemLogsController {
  constructor(private service: SystemLogsService) {}

  @Get()
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('module') mod?: string,
    @Query('level') level?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.list({ page, pageSize, module: mod, level, startDate, endDate });
  }
}
