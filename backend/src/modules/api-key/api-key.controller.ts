import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { name: string; permissions?: string; rateLimit?: number },
  ) {
    return this.apiKeyService.create(user.id, body);
  }

  @Get()
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.apiKeyService.findByUser(user.id);
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: CurrentUserPayload, @Param('id') id: number) {
    await this.apiKeyService.revoke(user.id, id);
    return { success: true };
  }

  @Patch(':id/toggle')
  async toggle(@CurrentUser() user: CurrentUserPayload, @Param('id') id: number) {
    return this.apiKeyService.toggle(user.id, id);
  }

  @Get('stats')
  async stats(@CurrentUser() user: CurrentUserPayload) {
    return this.apiKeyService.getStats(user.id);
  }
}
