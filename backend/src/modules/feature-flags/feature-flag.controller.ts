import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FeatureFlagService } from './feature-flag.service';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  async list() {
    return this.flags.listFlags();
  }

  @Get(':key')
  async check(@Param('key') key: string) {
    return this.flags.checkFlag(key);
  }

  @Post('set')
  async set(@Body() body: { key: string; enabled: boolean }) {
    return this.flags.setFlag(body.key, body.enabled);
  }

  @Post('set-many')
  async setMany(@Body() body: { flags: Array<{ key: string; enabled: boolean }> }) {
    await this.flags.setManyFlags(body.flags);
    return { message: 'Flags updated' };
  }

  @Post('invalidate-cache')
  async invalidateCache() {
    this.flags.invalidateCache();
    return { message: 'Cache invalidated' };
  }
}