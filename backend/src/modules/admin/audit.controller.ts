import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('admin/audit-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('module') mod?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const rid = resourceId ? Number(resourceId) : undefined;
    return this.service.list({
      page: Number(page),
      pageSize: Number(pageSize),
      module: mod,
      action,
      resourceType,
      resourceId: Number.isFinite(rid as number) ? (rid as number) : undefined,
      startDate,
      endDate,
    });
  }
}
