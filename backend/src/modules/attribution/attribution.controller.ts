import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AttributionService } from './attribution.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateAttributionDto } from './dto/attribution.dto';

@Controller('api/analysis')
@UseGuards(JwtAuthGuard)
export class AttributionController {
  constructor(private readonly attributionService: AttributionService) {}

  @Post('attribution')
  async createAnalysis(@Body() dto: CreateAttributionDto) {
    const analysis = await this.attributionService.createAnalysis(dto.eventId);
    return { message: '归因分析已创建', data: analysis };
  }

  @Get('attribution/:eventId')
  async getAnalysis(@Param('eventId') eventId: string) {
    const analysis = await this.attributionService.getAnalysis(+eventId);
    return { data: analysis };
  }
}
