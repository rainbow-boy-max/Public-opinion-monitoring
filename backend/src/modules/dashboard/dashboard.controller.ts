import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('dashboards')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService.findAll(user.id);
  }

  @Post()
  async create(@CurrentUser() user: CurrentUserPayload, @Body() body: { name: string; layout?: string; widgets?: string; isDefault?: number }) {
    return this.dashboardService.create(user.id, body);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: number) {
    return this.dashboardService.findOne(user.id, id);
  }

  @Put(':id')
  async update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: number, @Body() body: { name?: string; layout?: string; widgets?: string; isDefault?: number }) {
    return this.dashboardService.update(user.id, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: number) {
    return this.dashboardService.remove(user.id, id);
  }

  @Put(':id/layout')
  async updateLayout(@CurrentUser() user: CurrentUserPayload, @Param('id') id: number, @Body('layout') layout: string) {
    return this.dashboardService.updateLayout(user.id, id, layout);
  }

  @Get('widget-data/:type')
  async getWidgetData(
    @CurrentUser() user: CurrentUserPayload,
    @Param('type') type: string,
    @Query() query: Record<string, any>,
  ) {
    return this.dashboardService.getWidgetData(user.id, type, query);
  }

  @Post('widget-data')
  async getWidgetDataWithConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { type: string; config?: Record<string, any> },
  ) {
    return this.dashboardService.getWidgetData(user.id, body.type, body.config || {});
  }
}
