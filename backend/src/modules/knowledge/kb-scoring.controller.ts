import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KbScoringService } from './kb-scoring.service';

@Controller('admin/kb-scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class KbScoringController {
  constructor(private readonly service: KbScoringService) {}

  @Get('config')
  async getConfig() {
    return this.service.getConfig();
  }

  @Put('config')
  @HttpCode(HttpStatus.OK)
  async putConfig(
    @Body()
    body: {
      primaryModelId?: number;
      fallbackModelIds?: number[];
      enableWebSearch?: boolean;
      enableVision?: boolean;
    },
    @CurrentUser('id') operatorId?: number,
  ) {
    await this.service.saveConfig(body, operatorId ?? null);
    return this.service.getConfig();
  }
}
