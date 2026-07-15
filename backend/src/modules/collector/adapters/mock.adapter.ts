import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import { RawOpinionEvent, FetchOptions, HealthStatus } from './platform-adapter.interface';

@Injectable()
export class MockAdapter extends BaseAdapter {
  readonly platform = 'mock';
  readonly displayName = '模拟数据';

  async fetchByKeywords(keywords: string[], options: FetchOptions): Promise<RawOpinionEvent[]> {
    const results: RawOpinionEvent[] = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const publishedAt = new Date(now.getTime() - Math.random() * 86400000);
      results.push({
        platform: 'mock',
        title: `[模拟] 关于 "${keywords.join(',')}" 的第 ${i + 1} 条结果`,
        content: `这是一条模拟的舆情数据，关键词为：${keywords.join('、')}。来源为模拟平台，仅供参考测试用途。`,
        author: `模拟作者_${i + 1}`,
        authorAvatar: '',
        publishTime: publishedAt,
        url: `https://example.com/mock/${i}`,
        readCount: Math.floor(Math.random() * 10000),
        likeCount: Math.floor(Math.random() * 1000),
        commentCount: Math.floor(Math.random() * 500),
        shareCount: Math.floor(Math.random() * 200),
        rawData: { source: 'mock', keywords },
      });
    }
    return results;
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: true, message: 'Mock adapter always healthy', checkedAt: new Date().toISOString() };
  }
}
