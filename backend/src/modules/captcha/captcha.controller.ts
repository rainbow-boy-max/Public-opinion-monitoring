import { Controller, Get, Post, Body, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CaptchaService, CaptchaConfig } from './captcha.service';

@Controller('captcha')
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getConfig(): Promise<CaptchaConfig> {
    return this.captcha.getConfig();
  }

  @Put('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateConfig(@Body() dto: Partial<CaptchaConfig>): Promise<CaptchaConfig> {
    return this.captcha.updateConfig(dto);
  }

  @Post('verify')
  async verify(@Body() body: { captchaVerifyParam: string; sceneId?: string }) {
    const result = await this.captcha.verify(body.captchaVerifyParam, body.sceneId);
    return { success: result };
  }
}