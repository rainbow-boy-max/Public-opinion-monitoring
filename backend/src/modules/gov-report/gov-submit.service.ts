import { Injectable, Logger } from '@nestjs/common';

export type SubmitChannel = 'dingtalk' | 'feishu' | 'wecom' | 'custom';

interface PushResult {
  success: boolean;
  message: string;
  statusCode?: number;
}

@Injectable()
export class GovSubmitService {
  private readonly logger = new Logger(GovSubmitService.name);

  async pushToWebhook(
    webhookUrl: string,
    title: string,
    content: string,
  ): Promise<boolean> {
    const platform = this.detectPlatform(webhookUrl);
    const payload = this.buildPayload(platform, title, content);

    try {
      const result = await this.send(webhookUrl, payload);
      if (result.success) {
        this.logger.log(`简报上报成功: ${title} -> ${platform}`);
      } else {
        this.logger.warn(`简报上报失败: ${title} -> ${platform}, ${result.message}`);
      }
      return result.success;
    } catch (err) {
      this.logger.error(`简报上报异常: ${(err as Error).message}`);
      return false;
    }
  }

  private detectPlatform(url: string): SubmitChannel {
    if (url.includes('oapi.dingtalk.com')) return 'dingtalk';
    if (url.includes('open.feishu.cn') || url.includes('hooks.feishu.cn')) return 'feishu';
    if (url.includes('qyapi.weixin.qq.com')) return 'wecom';
    return 'custom';
  }

  private buildPayload(
    platform: SubmitChannel,
    title: string,
    content: string,
  ): unknown {
    const summary = this.extractSummary(content);

    switch (platform) {
      case 'dingtalk':
        return {
          msgtype: 'actionCard',
          actionCard: {
            title: `政务简报: ${title}`,
            text: `### 政务舆情简报\n\n**${title}**\n\n${summary}\n\n[查看完整简报]`,
          },
        };

      case 'feishu':
        return {
          msg_type: 'interactive',
          card: {
            header: {
              title: { tag: 'plain_text', content: `政务简报: ${title}` },
              template: 'blue',
            },
            elements: [
              {
                tag: 'div',
                text: { tag: 'lark_md', content: `**${title}**\n\n${summary}` },
              },
            ],
          },
        };

      case 'wecom':
        return {
          msgtype: 'markdown',
          markdown: {
            content: `## 政务舆情简报\n>**${title}**\n>\n>${summary}`,
          },
        };

      default:
        return {
          type: 'gov_briefing',
          title,
          content,
          summary,
          timestamp: new Date().toISOString(),
        };
    }
  }

  private extractSummary(content: string, maxLen = 500): string {
    const lines = content
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => l.replace(/^[-*]\s/, '').replace(/^\d+\.\s/, ''));
    const text = lines.join('\n').trim();
    return text.length <= maxLen ? text : text.substring(0, maxLen) + '...';
  }

  private async send(url: string, payload: unknown): Promise<PushResult> {
    const body = JSON.stringify(payload);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      const responseBody = await response.text();

      if (response.ok) {
        return { success: true, message: 'OK', statusCode: response.status };
      }
      return {
        success: false,
        message: `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
        statusCode: response.status,
      };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    } finally {
      clearTimeout(timer);
    }
  }
}
