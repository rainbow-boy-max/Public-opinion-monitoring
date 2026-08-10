import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateInstructionDto,
  CreateMonitorSiteDto,
  ExportBriefingDto,
  GenerateBriefingDto,
  QueryBriefingDto,
  QueryInstructionDto,
  QueryMonitorChangeDto,
  QueryMonitorSiteDto,
  SubmitBriefingDto,
  UpdateInstructionDto,
  UpdateMonitorSiteDto,
} from './dto/gov-report.dto';
import { GovBriefingService } from './gov-briefing.service';
import { LeaderInstructionService } from './leader-instruction.service';
import { GovMonitorService } from './gov-monitor.service';

@Controller('gov')
@UseGuards(JwtAuthGuard)
export class GovReportController {
  constructor(
    private readonly briefingService: GovBriefingService,
    private readonly instructionService: LeaderInstructionService,
    private readonly monitorService: GovMonitorService,
  ) {}

  @Post('briefing/generate')
  async generateBriefing(
    @Body() dto: GenerateBriefingDto,
    @CurrentUser('id') userId: number,
  ) {
    const data = await this.briefingService.generate({
      briefingType: dto.briefingType,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      title: dto.title,
      useLlm: dto.useLlm,
      createdBy: userId,
    });
    return { message: '简报生成成功', data };
  }

  @Get('briefing')
  async listBriefings(@Query() query: QueryBriefingDto) {
    return this.briefingService.list(query);
  }

  @Get('briefing/:id')
  async getBriefing(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.briefingService.getById(id) };
  }

  @Post('briefing/:id/submit')
  async submitBriefing(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitBriefingDto,
  ) {
    return {
      message: '简报上报状态已更新',
      data: await this.briefingService.submit(id, dto.submittedTo, dto.webhookUrl),
    };
  }

  @Get('briefing/:id/export')
  async exportBriefing(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: ExportBriefingDto,
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.briefingService.export(id, dto.format);
    res.set('Content-Type', mimeType);
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }

  @Delete('briefing/:id')
  async deleteBriefing(@Param('id', ParseIntPipe) id: number) {
    await this.briefingService.delete(id);
    return { message: '简报已删除' };
  }

  @Post('instruction')
  async createInstruction(
    @Body() dto: CreateInstructionDto,
    @CurrentUser('id') userId: number,
  ) {
    const data = await this.instructionService.create({
      eventId: dto.eventId,
      leaderName: dto.leaderName,
      instruction: dto.instruction,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      createdBy: userId,
    });
    return { message: '领导批示已创建', data };
  }

  @Get('instruction')
  async listInstructions(@Query() query: QueryInstructionDto) {
    return this.instructionService.list(query);
  }

  @Get('instruction/:id')
  async getInstruction(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.instructionService.getById(id) };
  }

  @Put('instruction/:id')
  async updateInstruction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstructionDto,
  ) {
    const data = await this.instructionService.update(id, {
      status: dto.status,
      handlerName: dto.handlerName,
      feedback: dto.feedback,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    });
    return { message: '领导批示已更新', data };
  }

  @Post('monitor/site')
  async createMonitorSite(
    @Body() dto: CreateMonitorSiteDto,
    @CurrentUser('id') userId: number,
  ) {
    const data = await this.monitorService.createSite({
      siteName: dto.siteName,
      url: dto.url,
      siteType: dto.siteType,
      cssSelector: dto.cssSelector,
      checkFrequency: dto.checkFrequency,
      createdBy: userId,
    });
    return { message: '监测站点已创建', data };
  }

  @Get('monitor/site')
  async listMonitorSites(@Query() query: QueryMonitorSiteDto) {
    return this.monitorService.listSites(query);
  }

  @Get('monitor/site/:id')
  async getMonitorSite(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.monitorService.getSiteById(id) };
  }

  @Put('monitor/site/:id')
  async updateMonitorSite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMonitorSiteDto,
  ) {
    const data = await this.monitorService.updateSite(id, {
      siteName: dto.siteName,
      url: dto.url,
      siteType: dto.siteType,
      cssSelector: dto.cssSelector,
      checkFrequency: dto.checkFrequency,
      status: dto.status,
    });
    return { message: '监测站点已更新', data };
  }

  @Delete('monitor/site/:id')
  async deleteMonitorSite(@Param('id', ParseIntPipe) id: number) {
    await this.monitorService.deleteSite(id);
    return { message: '监测站点已删除' };
  }

  @Post('monitor/site/:id/check')
  async checkMonitorSite(@Param('id', ParseIntPipe) id: number) {
    const data = await this.monitorService.checkSite(id);
    return { message: '站点检查完成', data };
  }

  @Post('monitor/check-all')
  async checkAllSites() {
    const data = await this.monitorService.checkAllDueSites();
    return { message: '批量检查完成', data };
  }

  @Get('monitor/change')
  async listMonitorChanges(@Query() query: QueryMonitorChangeDto) {
    return this.monitorService.listChanges(query);
  }

  @Post('monitor/change/:id/read')
  async markChangeRead(@Param('id', ParseIntPipe) id: number) {
    const data = await this.monitorService.markChangeRead(id);
    return { message: '变更已标记为已读', data };
  }

  @Post('monitor/change/read-all')
  async markAllChangesRead(@Body('siteId') siteId?: number) {
    const data = await this.monitorService.markAllRead(siteId);
    return { message: `已标记 ${data.updated} 条变更为已读`, data };
  }
}
