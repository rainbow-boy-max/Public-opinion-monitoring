import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ShortVideoService } from './short-video.service';

@Injectable()
export class VideoCollectorService {
  private readonly logger = new Logger(VideoCollectorService.name);

  constructor(private readonly shortVideoService: ShortVideoService) {}

  // 每 30 分钟采集一次（生产环境启用）
  // @Cron('0 */30 * * * *')
  async collectVideos() {
    this.logger.log('Starting video collection task');

    try {
      // TODO: 实现视频采集逻辑
      // 1. 获取监测关键词列表
      // 2. 调用抖音/快手/视频号 API 搜索视频
      // 3. 解析视频元数据
      // 4. 调用 shortVideoService.createVideo() 保存

      this.logger.warn('Video collection implementation pending');
      this.logger.log('Video collection task completed');
    } catch (error) {
      this.logger.error(`Video collection failed: ${error.message}`);
    }
  }

  // 手动触发采集（测试用）
  async collectByKeyword(keyword: string, platform: string) {
    this.logger.log(`Collecting videos for keyword: ${keyword} on ${platform}`);
    // TODO: 实现单次采集逻辑
  }
}
