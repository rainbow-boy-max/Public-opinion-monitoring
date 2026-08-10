import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('ops')
export class OpsController {
  constructor(private readonly metricsSvc: MetricsService) {}

  @Get('healthz')
  async healthz(): Promise<Record<string, any>> {
    return this.metricsSvc.getHealth();
  }

  @Get('metrics')
  async metrics(): Promise<Record<string, any>> {
    return this.metricsSvc.getMetrics();
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async prometheus(): Promise<string> {
    return this.metricsSvc.getPrometheusText();
  }
}
