import { Controller, Get, Post, Body } from '@nestjs/common';
import { ArchiveService, ArchiveConfig } from './archive.service';

@Controller('archive')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('stats')
  async stats() {
    return this.archiveService.getArchiveStats();
  }

  @Get('config')
  async getConfig() {
    return this.archiveService.getConfig();
  }

  @Post('config')
  async updateConfig(@Body() body: Partial<ArchiveConfig>) {
    this.archiveService.updateConfig(body);
    return { message: 'Archive config updated', config: this.archiveService.getConfig() };
  }

  @Post('run')
  async runNow() {
    await this.archiveService.runDailyArchive();
    return { message: 'Archive job completed' };
  }
}