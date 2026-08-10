import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface OverseasMention {
  platform: string;
  title: string;
  content: string;
  author: string;
  url: string;
  publishTime: Date;
  language: string;
  translatedTitle: string;
  translatedContent: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
}

export interface TranslationResult {
  source: string;
  target: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;
}

@Injectable()
export class CrossBorderMonitorService {
  private readonly logger = new Logger(CrossBorderMonitorService.name);

  private readonly overseasPlatforms = [
    { name: 'Twitter/X', url: 'https://twitter.com', type: 'social', lang: 'en' },
    { name: 'Reddit', url: 'https://reddit.com', type: 'forum', lang: 'en' },
    { name: 'Facebook', url: 'https://facebook.com', type: 'social', lang: 'en' },
    { name: 'YouTube', url: 'https://youtube.com', type: 'video', lang: 'en' },
    { name: 'TikTok', url: 'https://tiktok.com', type: 'short_video', lang: 'en' },
    { name: 'Instagram', url: 'https://instagram.com', type: 'social', lang: 'en' },
    { name: 'Naver', url: 'https://naver.com', type: 'portal', lang: 'ko' },
    { name: 'Yahoo Japan', url: 'https://yahoo.co.jp', type: 'portal', lang: 'ja' },
    { name: 'Weibo', url: 'https://weibo.com', type: 'social', lang: 'zh' },
    { name: 'VK', url: 'https://vk.com', type: 'social', lang: 'ru' },
  ];

  async translate(text: string, targetLang = 'zh'): Promise<TranslationResult> {
    const detected = this.detectLanguage(text);
    if (detected === targetLang) {
      return { source: text, target: text, sourceLang: detected, targetLang, confidence: 1 };
    }

    const translated = this.simulateTranslate(text, detected, targetLang);
    return {
      source: text,
      target: translated,
      sourceLang: detected,
      targetLang,
      confidence: 0.85,
    };
  }

  async searchOverseas(keywords: string[], platforms?: string[]): Promise<OverseasMention[]> {
    const allMentions: OverseasMention[] = [];
    const targetPlatforms = platforms
      ? this.overseasPlatforms.filter((p) => platforms.includes(p.name))
      : this.overseasPlatforms;

    for (const platform of targetPlatforms) {
      for (const keyword of keywords) {
        const mentions = await this.simulateOverseasSearch(platform, keyword);
        allMentions.push(...mentions);
      }
    }

    return allMentions;
  }

  getPlatforms() {
    return this.overseasPlatforms;
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledCheck(): Promise<void> {
    this.logger.log('Running scheduled cross-border monitoring');
  }

  private detectLanguage(text: string): string {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;
    const russianChars = (text.match(/[\u0400-\u04ff]/g) || []).length;
    const latinChars = (text.match(/[a-zA-Z]/g) || []).length;

    if (chineseChars > 10) return 'zh';
    if (japaneseChars > 5) return 'ja';
    if (koreanChars > 5) return 'ko';
    if (russianChars > 5) return 'ru';
    if (latinChars > 10) return 'en';
    return 'unknown';
  }

  private simulateTranslate(text: string, sourceLang: string, targetLang: string): string {
    if (sourceLang === 'en' && targetLang === 'zh') {
      const words = text.split(/\s+/).slice(0, 30);
      return `[翻译] ${words.join(' ')} — 自动翻译自英文`;
    }
    return `[翻译] ${text.substring(0, 200)} — 自动翻译自${sourceLang}语`;
  }

  private async simulateOverseasSearch(
    platform: { name: string; type: string; lang: string },
    keyword: string,
  ): Promise<OverseasMention[]> {
    const results: OverseasMention[] = [];
    const count = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < count; i++) {
      const sentiments: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
      const originalTitle = this.generateForeignText(platform.lang, keyword, i);
      const originalContent = this.generateForeignText(platform.lang, `${keyword} discussion`, i + 5);

      results.push({
        platform: platform.name,
        title: originalTitle,
        content: originalContent,
        author: `${platform.name}_user_${Math.random().toString(36).substring(2, 6)}`,
        url: `https://${platform.name.toLowerCase()}.com/post/${Date.now()}`,
        publishTime: new Date(Date.now() - Math.random() * 86400000),
        language: platform.lang,
        translatedTitle: platform.lang !== 'zh' ? `[译] ${keyword} 相关讨论 #${i + 1}` : originalTitle,
        translatedContent: platform.lang !== 'zh' ? `[译] 关于"${keyword}"的海外社交媒体讨论内容` : originalContent,
        sentiment: sentiments[Math.floor(Math.random() * 3)],
        keywords: [keyword],
      });
    }

    return results;
  }

  private generateForeignText(lang: string, keyword: string, seed: number): string {
    if (lang === 'en') return `Discussion about "${keyword}" on social media platform #${seed}`;
    if (lang === 'ja') return `「${keyword}」に関する${seed}番目の議論`;
    if (lang === 'ko') return `"${keyword}"에 대한 ${seed}번째 토론`;
    if (lang === 'ru') return `Обсуждение "${keyword}" #${seed}`;
    return `Discussion about ${keyword} #${seed}`;
  }
}