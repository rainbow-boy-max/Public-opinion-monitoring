import { Injectable, Logger } from '@nestjs/common';
import { RawOpinionEvent } from './adapters/platform-adapter.interface';
import { OpinionEventEntity, PlatformType, Sentiment } from '../../database/entities';

const VALID_PLATFORMS: PlatformType[] = [
  'weixin',
  'weixin_video',
  'douyin',
  'xiaohongshu',
  'kuaishou',
  'weibo',
  'baijiahao',
];

const POSITIVE_KEYWORDS = ['好', '赞', '喜欢', '支持', '感谢', '优秀', '推荐', 'good', 'great', 'excellent'];
const NEGATIVE_KEYWORDS = [
  '差',
  '糟',
  '失望',
  '讨厌',
  '批评',
  '曝光',
  '投诉',
  '质疑',
  'bad',
  'terrible',
  'awful',
  'disappointed',
];

@Injectable()
export class OpinionNormalizerService {
  private readonly logger = new Logger(OpinionNormalizerService.name);

  normalize(raw: RawOpinionEvent, taskId: number, matchedKeywords: string[]): OpinionEventEntity | null {
    if (!raw.title || !raw.url) {
      this.logger.warn(`Skipping raw event: missing required fields (title or url)`);
      return null;
    }

    const platform = this.normalizePlatform(raw.platform);
    const sentiment = this.detectSentiment(raw.title + ' ' + (raw.content || ''));
    const summary = this.buildSummary(raw.content || '');

    const event = new OpinionEventEntity();
    event.taskId = taskId;
    event.platform = platform;
    event.title = this.truncate(raw.title, 512);
    event.content = raw.content || '';
    event.summary = summary;
    event.author = raw.author || 'unknown';
    event.authorAvatar = raw.authorAvatar || null;
    event.publishTime = raw.publishTime || new Date();
    event.url = raw.url;
    event.readCount = raw.readCount || 0;
    event.likeCount = raw.likeCount || 0;
    event.commentCount = raw.commentCount || 0;
    event.shareCount = raw.shareCount || 0;
    event.sentiment = sentiment;
    event.matchedKeywords = matchedKeywords;
    event.rawData = raw.rawData || {};
    event.status = 0;
    event.matchedAt = new Date();
    return event;
  }

  private normalizePlatform(raw: string): PlatformType {
    const p = raw.toLowerCase().trim();
    if ((VALID_PLATFORMS as string[]).includes(p)) {
      return p as PlatformType;
    }
    return 'weibo';
  }

  private detectSentiment(text: string): Sentiment {
    const lower = text.toLowerCase();
    let posCount = 0;
    let negCount = 0;
    for (const k of POSITIVE_KEYWORDS) {
      const regex = new RegExp(`\\b${k}\\b`, 'i');
      if (regex.test(lower)) posCount++;
    }
    for (const k of NEGATIVE_KEYWORDS) {
      const regex = new RegExp(`\\b${k}\\b`, 'i');
      if (regex.test(lower)) negCount++;
    }
    if (negCount > posCount && negCount > 0) return 'negative';
    if (posCount > negCount && posCount > 0) return 'positive';
    return 'neutral';
  }

  private buildSummary(content: string, maxLen = 200): string {
    if (!content) return '';
    const stripped = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return stripped.length <= maxLen ? stripped : stripped.substring(0, maxLen) + '...';
  }

  private truncate(text: string, maxLen: number): string {
    return text.length <= maxLen ? text : text.substring(0, maxLen);
  }
}