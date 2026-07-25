import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ShortVideoEntity } from '../../database/entities/short-video.entity';
import { VideoFrameEntity } from '../../database/entities/video-frame.entity';
import { VideoTranscriptEntity } from '../../database/entities/video-transcript.entity';
import { ShortVideoService } from './short-video.service';
import { ShortVideoController } from './short-video.controller';
import { VideoCollectorService } from './video-collector.service';
import { VideoOcrProcessor } from './processors/video-ocr.processor';
import { VideoAsrProcessor } from './processors/video-asr.processor';
import { VideoAnalysisProcessor } from './processors/video-analysis.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShortVideoEntity,
      VideoFrameEntity,
      VideoTranscriptEntity,
    ]),
    BullModule.registerQueue(
      { name: 'video-ocr' },
      { name: 'video-asr' },
      { name: 'video-analysis' },
    ),
  ],
  controllers: [ShortVideoController],
  providers: [
    ShortVideoService,
    VideoCollectorService,
    VideoOcrProcessor,
    VideoAsrProcessor,
    VideoAnalysisProcessor,
  ],
  exports: [ShortVideoService],
})
export class ShortVideoModule {}
