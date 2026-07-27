import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePredictionDto, QueryPredictionDto } from './dto/prediction.dto';

@Controller('api/prediction')
@UseGuards(JwtAuthGuard)
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Post('trend')
  async createPrediction(@Body() dto: CreatePredictionDto) {
    const prediction = await this.predictionService.createPrediction(
      dto.eventId,
      dto.horizon
    );
    return { message: '趋势预测已创建', data: prediction };
  }

  @Get('trend/:eventId')
  async getPrediction(@Param('eventId') eventId: string) {
    const prediction = await this.predictionService.getPrediction(+eventId);
    return { data: prediction };
  }

  @Get('trend')
  async listPredictions(@Query() query: QueryPredictionDto) {
    const result = await this.predictionService.listPredictions(query);
    return result;
  }
}
