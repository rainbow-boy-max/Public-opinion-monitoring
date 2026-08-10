import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MfaService } from './mfa.service';
import { IsString, IsOptional } from 'class-validator';

class EnableMfaDto {
  @IsString()
  token: string;
}

class VerifyMfaDto {
  @IsString()
  token: string;
}

@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req) {
    const enabled = await this.mfaService.isMfaEnabled(req.user.id);
    return { enabled };
  }

  @Post('setup')
  @UseGuards(JwtAuthGuard)
  async setup(@Req() req) {
    const user = req.user;
    const result = await this.mfaService.setupMfa(user.id, user.username || 'admin');
    return result;
  }

  @Post('enable')
  @UseGuards(JwtAuthGuard)
  async enable(@Req() req, @Body() dto: EnableMfaDto) {
    const success = await this.mfaService.enableMfa(req.user.id, dto.token);
    return { success };
  }

  @Post('disable')
  @UseGuards(JwtAuthGuard)
  async disable(@Req() req) {
    await this.mfaService.disableMfa(req.user.id);
    return { message: 'MFA disabled' };
  }

  @Post('verify')
  async verify(@Body() dto: VerifyMfaDto & { userId: number }) {
    const success = await this.mfaService.verifyMfa(dto.userId, dto.token);
    return { success };
  }
}
