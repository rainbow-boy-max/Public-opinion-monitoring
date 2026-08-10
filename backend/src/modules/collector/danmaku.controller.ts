import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DanmakuCollectorService } from './danmaku-collector.service';

@Controller('danmaku')
@UseGuards(JwtAuthGuard)
export class DanmakuController {
  constructor(private readonly danmaku: DanmakuCollectorService) {}

  @Post('monitor')
  async startMonitor(
    @Body() body: { roomId: string; taskId: number; keywords: string[] },
  ) {
    await this.danmaku.startMonitoring(body.roomId, body.taskId, body.keywords);
    return { message: `Started monitoring live room ${body.roomId}` };
  }

  @Delete('monitor/:roomId')
  async stopMonitor(@Param('roomId') roomId: string) {
    await this.danmaku.stopMonitoring(roomId);
    return { message: `Stopped monitoring live room ${roomId}` };
  }

  @Get('rooms')
  async getActiveRooms() {
    return { rooms: this.danmaku.getActiveRooms() };
  }
}