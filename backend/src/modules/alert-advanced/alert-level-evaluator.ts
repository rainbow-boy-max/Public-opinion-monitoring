import { Injectable, Logger } from '@nestjs/common';
import { OpinionEventEntity } from '../../database/entities/opinion-event.entity';
import { AlertLevel } from '../../database/entities/alert-config.entity';

@Injectable()
export class AlertLevelEvaluator {
  private readonly logger = new Logger(AlertLevelEvaluator.name);

  /**
   * 评估舆情事件的预警等级
   * 评分维度：阅读量(30) + 互动量(30) + 情感(20) + 传播速度(20)
   */
  evaluateLevel(event: OpinionEventEntity): { level: AlertLevel; score: number } {
    let score = 0;

    // 阅读量评分（0-30 分）
    if (event.readCount > 100000) score += 30;
    else if (event.readCount > 50000) score += 20;
    else if (event.readCount > 10000) score += 10;

    // 互动量评分（0-30 分）
    const engagement = event.likeCount + event.commentCount + event.shareCount;
    if (engagement > 10000) score += 30;
    else if (engagement > 5000) score += 20;
    else if (engagement > 1000) score += 10;

    // 情感评分（0-20 分）
    if (event.sentiment === 'negative') score += 20;
    else if (event.sentiment === 'neutral') score += 5;

    // 传播速度评分（0-20 分）
    const age = Date.now() - event.publishTime.getTime();
    const hoursSincePublish = Math.max(age / (1000 * 3600), 1);
    const growthRate = event.readCount / hoursSincePublish;
    if (growthRate > 5000) score += 20;
    else if (growthRate > 2000) score += 10;
    else if (growthRate > 500) score += 5;

    // 评级
    let level: AlertLevel;
    if (score >= 80) level = AlertLevel.CRITICAL;
    else if (score >= 60) level = AlertLevel.MAJOR;
    else if (score >= 40) level = AlertLevel.IMPORTANT;
    else level = AlertLevel.NORMAL;

    this.logger.debug(`Event ${event.id} evaluated: score=${score}, level=${level}`);

    return { level, score };
  }

  /**
   * 检查事件是否满足触发条件
   */
  matchesTriggerConditions(
    event: OpinionEventEntity,
    conditions: {
      readCount?: number;
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
      sentiment?: string[];
      keywords?: string[];
    },
  ): boolean {
    if (conditions.readCount && event.readCount < conditions.readCount) return false;
    if (conditions.likeCount && event.likeCount < conditions.likeCount) return false;
    if (conditions.commentCount && event.commentCount < conditions.commentCount) return false;
    if (conditions.shareCount && event.shareCount < conditions.shareCount) return false;

    if (conditions.sentiment && conditions.sentiment.length > 0) {
      if (!conditions.sentiment.includes(event.sentiment)) return false;
    }

    if (conditions.keywords && conditions.keywords.length > 0) {
      const eventText = (event.title + ' ' + event.content).toLowerCase();
      const hasKeyword = conditions.keywords.some(kw =>
        eventText.includes(kw.toLowerCase()),
      );
      if (!hasKeyword) return false;
    }

    return true;
  }

  /**
   * 检查当前时间是否在免打扰时段
   */
  isInQuietHours(quietHours: { start: string; end: string } | null): boolean {
    if (!quietHours) return false;

    const now = new Date();
    const currentHourMin =
      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    const start = quietHours.start;
    const end = quietHours.end;

    // 处理跨天情况（如 22:00 - 08:00）
    if (start > end) {
      return currentHourMin >= start || currentHourMin < end;
    } else {
      return currentHourMin >= start && currentHourMin < end;
    }
  }

  /**
   * 根据预警等级获取推送延迟（毫秒）
   */
  getPushDelay(level: AlertLevel): number {
    switch (level) {
      case AlertLevel.CRITICAL:
        return 0; // 立即推送
      case AlertLevel.MAJOR:
        return 0; // 立即推送
      case AlertLevel.IMPORTANT:
        return 4 * 3600 * 1000; // 4 小时
      case AlertLevel.NORMAL:
      default:
        return 24 * 3600 * 1000; // 24 小时
    }
  }

  /**
   * 生成预警内容
   */
  generateAlertContent(event: OpinionEventEntity, level: AlertLevel, score: number): string {
    const levelText = {
      [AlertLevel.NORMAL]: '一般',
      [AlertLevel.IMPORTANT]: '重要',
      [AlertLevel.MAJOR]: '重大',
      [AlertLevel.CRITICAL]: '特级',
    };

    return `【${levelText[level]}舆情预警】
事件标题：${event.title}
发布平台：${event.platform}
发布时间：${event.publishTime.toISOString()}
阅读量：${event.readCount}
点赞：${event.likeCount} | 评论：${event.commentCount} | 转发：${event.shareCount}
情感倾向：${event.sentiment}
风险评分：${score}/100
预警等级：${levelText[level]}

请及时关注并处理。`;
  }
}
