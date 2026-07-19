import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsString, IsOptional, IsNumber, Min, IsArray, ArrayMaxSize } from 'class-validator';

class ImageOcrDto {
  @IsString()
  url: string;
}

class VideoOcrDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  frameInterval?: number;
}

class SetOcrConfigDto {
  @IsNumber()
  primaryModelId: number;

  @IsArray()
  @ArrayMaxSize(5)
  backupModelIds: number[];
}

@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private ocrService: OcrService) {}

  @Get('config')
  async getConfig() {
    return this.ocrService.getFullConfig();
  }

  @Post('config')
  async setConfig(@Body() dto: SetOcrConfigDto) {
    await this.ocrService.setOcrConfig(dto);
    return { ok: true };
  }

  @Post('image')
  async recognizeImage(@Body() dto: ImageOcrDto) {
    const text = await this.ocrService.recognizeImage(dto.url);
    return { text };
  }

  @Post('video')
  async recognizeVideo(@Body() dto: VideoOcrDto) {
    const result = await this.ocrService.recognizeVideo(dto.url, dto.frameInterval || 30);
    return result;
  }
}
