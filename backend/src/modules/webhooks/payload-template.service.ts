import { Injectable, Logger } from '@nestjs/common';
import { WebhookEntity, WebhookFormat, OpinionEventEntity } from '../../database/entities';

interface RenderableEvent {
  platform: string;
  title: string;
  content: string;
  summary: string;
  author: string;
  publishTime: Date;
  url: string;
  readCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  sentiment: string;
  keywords: string[];
}

@Injectable()
export class PayloadTemplateService {
  private readonly logger = new Logger(PayloadTemplateService.name);

  render(webhook: WebhookEntity, event: RenderableEvent): unknown {
    switch (webhook.format) {
      case WebhookFormat.WECOM:
        return this.renderWecom(event);
      case WebhookFormat.DINGTALK:
        return this.renderDingtalk(event);
      case WebhookFormat.FEISHU:
        return this.renderFeishu(event);
      case WebhookFormat.CUSTOM_JSON:
        return this.renderCustomJson(event);
      default:
        return { msgtype: 'text', text: { content: event.title } };
    }
  }

  private renderWecom(event: RenderableEvent): unknown {
    const publishTime = new Date(event.publishTime).toLocaleString('zh-CN');
    return {
      msgtype: 'markdown',
      markdown: {
        content:
          `## 舆情告警\n` +
          `>**平台**: ${event.platform}\n` +
          `>**关键词**: ${event.keywords.join(', ')}\n` +
          `>**标题**: ${event.title}\n` +
          `>**阅读**: ${event.readCount} | **点赞**: ${event.likeCount}\n` +
          `>**时间**: ${publishTime}\n` +
          `>[查看原文](${event.url})`,
      },
    };
  }

  private renderDingtalk(event: RenderableEvent): unknown {
    const publishTime = new Date(event.publishTime).toLocaleString('zh-CN');
    return {
      msgtype: 'actionCard',
      actionCard: {
        title: `舆情告警 - ${event.keywords.join(',')}`,
        text:
          `### 舆情告警\n\n` +
          `**平台**: ${event.platform}\n` +
          `**关键词**: ${event.keywords.join(', ')}\n` +
          `**标题**: ${event.title}\n` +
          `**阅读**: ${event.readCount}\n` +
          `**时间**: ${publishTime}`,
        singleTitle: '查看原文',
        singleURL: event.url,
      },
    };
  }

  private renderFeishu(event: RenderableEvent): unknown {
    const publishTime = new Date(event.publishTime).toLocaleString('zh-CN');
    return {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: '舆情告警' },
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content:
                `**平台**: ${event.platform}\n` +
                `**关键词**: ${event.keywords.join(', ')}\n` +
                `**标题**: ${event.title}\n` +
                `**阅读**: ${event.readCount}\n` +
                `**时间**: ${publishTime}`,
            },
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: { tag: 'plain_text', content: '查看原文' },
                url: event.url,
                type: 'primary',
              },
            ],
          },
        ],
      },
    };
  }

  private renderCustomJson(event: RenderableEvent): unknown {
    return {
      platform: event.platform,
      title: event.title,
      content: event.content,
      summary: event.summary,
      author: event.author,
      publishTime: new Date(event.publishTime).toISOString(),
      url: event.url,
      readCount: event.readCount,
      likeCount: event.likeCount,
      commentCount: event.commentCount,
      shareCount: event.shareCount,
      sentiment: event.sentiment,
      keywords: event.keywords,
    };
  }

  async sendPayload(
    url: string,
    payload: unknown,
    secretKey: string | null,
  ): Promise<{ status: number; body: string }> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (secretKey) {
      const { createHmac } = await import('crypto');
      const signature = createHmac('sha256', secretKey).update(body).digest('hex');
      headers['X-Signature'] = signature;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      const responseBody = await response.text();
      return { status: response.status, body: responseBody };
    } finally {
      clearTimeout(timer);
    }
  }

  buildSummary(content: string, maxLen = 200): string {
    if (!content) return '';
    const stripped = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return stripped.length <= maxLen ? stripped : stripped.substring(0, maxLen) + '...';
  }

  toTemplateEvent(event: OpinionEventEntity): RenderableEvent {
    return {
      platform: event.platform,
      title: event.title,
      content: event.content,
      summary: event.summary || this.buildSummary(event.content),
      author: event.author,
      publishTime: event.publishTime,
      url: event.url,
      readCount: event.readCount,
      likeCount: event.likeCount,
      commentCount: event.commentCount,
      shareCount: event.shareCount,
      sentiment: event.sentiment,
      keywords: event.matchedKeywords || [],
    };
  }
}
