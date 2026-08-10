import { Controller, Get, Put, Post, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AlertConfigService } from './alert-config.service';
import { AlertRecordService } from './alert-record.service';
import { UpdateAlertConfigDto, QueryAlertRecordsDto, ConfirmAlertDto } from './dto/alert-advanced.dto';

@Controller('alert-advanced')
@UseGuards(JwtAuthGuard)
export class AlertAdvancedController {
  constructor(
    private readonly configService: AlertConfigService,
    private readonly recordService: AlertRecordService,
  ) {}

  @Get('config')
  async getConfig(@Req() req: any) {
    const config = await this.configService.getConfigByUserId(req.user.id);
    return { data: config };
  }

  @Put('config')
  async updateConfig(@Body() dto: UpdateAlertConfigDto, @Req() req: any) {
    const config = await this.configService.createOrUpdateConfig({
      userId: req.user.id,
      ...dto,
    });
    return { message: '预警配置已更新', data: config };
  }

  @Get('records')
  async getRecords(@Query() query: QueryAlertRecordsDto) {
    const result = await this.recordService.getRecords(query);
    return result;
  }

  @Get('records/:id')
  async getRecord(@Param('id') id: string) {
    const record = await this.recordService.getRecordById(+id);
    return { data: record };
  }

  @Post('records/:id/confirm')
  async confirmRecord(
    @Param('id') id: string,
    @Body() dto: ConfirmAlertDto,
    @Req() req: any,
  ) {
    await this.recordService.confirmRecord(+id, req.user.id, dto.feedback);
    return { message: '预警已确认' };
  }
}
