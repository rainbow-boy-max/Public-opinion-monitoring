import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TtsService } from './tts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsNumber, IsIn, Min, Max } from 'class-validator';

class SynthesizeDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  speed?: number;

  @IsOptional()
  @IsString()
  @IsIn(['mp3', 'wav'])
  format?: 'mp3' | 'wav';

  @IsOptional()
  @IsString()
  provider?: string;
}

class SynthesizeReportDto {
  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  speed?: number;

  @IsOptional()
  @IsString()
  provider?: string;
}

@Controller('tts')
@UseGuards(JwtAuthGuard)
export class TtsController {
  constructor(private ttsService: TtsService) {}

  @Get('providers')
  getProviders() {
    return this.ttsService.getProviders();
  }

  @Post('synthesize')
  async synthesize(@Body() dto: SynthesizeDto) {
    return this.ttsService.synthesize(dto.text, {
      voiceId: dto.voiceId,
      speed: dto.speed,
      format: dto.format,
      provider: dto.provider,
    });
  }

  @Post('report/:reportId')
  async synthesizeReport(
    @CurrentUser('id') userId: number,
    @Param('reportId', ParseIntPipe) reportId: number,
    @Body() dto: SynthesizeReportDto,
  ) {
    return this.ttsService.synthesizeReport(reportId, userId, {
      voiceId: dto.voiceId,
      speed: dto.speed,
      provider: dto.provider,
    });
  }

  @Get('voices')
  async getVoices(@Query('provider') provider?: string) {
    return this.ttsService.getAvailableVoices(provider);
  }
}
