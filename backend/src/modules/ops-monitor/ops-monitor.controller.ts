import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OpsMonitorService } from './ops-monitor.service';

@Controller('ops-monitor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class OpsMonitorController {
  constructor(private readonly monitor: OpsMonitorService) {}

  @Get('check-all')
  async checkAll() {
    return this.monitor.checkAll();
  }

  @Get('check/:module')
  async checkModule(@Param('module') module: string) {
    return this.monitor.checkModule(module);
  }

  @Post('fix/:module')
  async fixModule(@Param('module') module: string) {
    return this.monitor.fixModule(module);
  }

  @Post('fix-all')
  async fixAll() {
    return this.monitor.fixAll();
  }
}