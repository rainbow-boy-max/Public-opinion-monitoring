import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async query(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.auditService.query({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      module,
      action,
      actorId: actorId ? Number(actorId) : undefined,
      resourceType,
      startDate,
      endDate,
      search,
    });
  }

  @Get('modules')
  async getModules() {
    return this.auditService.getModules();
  }

  @Get('actions')
  async getActions(@Query('module') module?: string) {
    return this.auditService.getActions(module);
  }
}
