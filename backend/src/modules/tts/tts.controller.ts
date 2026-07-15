import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TtsService } from './tts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
}

@Controller('tts')
@UseGuards(JwtAuthGuard)
export class TtsController {
  constructor(private ttsService: TtsService) {}

  @Post('synthesize')
  async synthesize(@Body() dto: SynthesizeDto) {
    return this.ttsService.synthesize(dto.text, {
      voiceId: dto.voiceId,
      speed: dto.speed,
      format: dto.format,
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
    });
  }

  @Get('voices')
  async getVoices() {
    return this.ttsService.getAvailableVoices();
  }
}
