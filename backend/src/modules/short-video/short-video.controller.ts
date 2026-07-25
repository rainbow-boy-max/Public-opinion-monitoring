import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ShortVideoService } from './short-video.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateVideoDto, QueryVideoDto } from './dto/video.dto';

@Controller('short-videos')
@UseGuards(JwtAuthGuard)
export class ShortVideoController {
  constructor(private readonly shortVideoService: ShortVideoService) {}

  @Post()
  async create(@Body() dto: CreateVideoDto) {
    return this.shortVideoService.createVideo(dto);
  }

  @Get()
  async findAll(@Query() query: QueryVideoDto) {
    return this.shortVideoService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const video = await this.shortVideoService.findOne(+id);
    if (!video) {
      return { message: 'Video not found' };
    }

    const [frames, transcripts] = await Promise.all([
      this.shortVideoService.getFrames(+id),
      this.shortVideoService.getTranscripts(+id),
    ]);

    return {
      ...video,
      frames,
      transcripts,
    };
  }
}
