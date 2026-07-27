import { Injectable, Logger } from '@nestjs/common';
import { AlertChannel } from '../../database/entities/alert-config.entity';

@Injectable()
export class AlertNotificationService {
  private readonly logger = new Logger(AlertNotificationService.name);

  /**
   * 发送通知（统一入口）
   */
  async sendNotification(
    channel: AlertChannel,
    recipient: string,
    content: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (channel) {
        case AlertChannel.SMS:
          return await this.sendSMS(recipient, content);
        case AlertChannel.EMAIL:
          return await this.sendEmail(recipient, content);
        case AlertChannel.WECHAT:
          return await this.sendWechat(recipient, content);
        case AlertChannel.DINGTALK:
          return await this.sendDingtalk(recipient, content);
        case AlertChannel.INTERNAL:
          return await this.sendInternal(recipient, content);
        default:
          return { success: false, error: 'Unsupported channel' };
      }
    } catch (error) {
      this.logger.error(`Send notification failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送短信（使用现有的短信服务）
   */
  private async sendSMS(phone: string, content: string): Promise<{ success: boolean; error?: string }> {
    // TODO: 集成现有的短信服务
    this.logger.log(`SMS to ${phone}: ${content}`);
    return { success: true };
  }

  /**
   * 发送邮件
   */
  private async sendEmail(email: string, content: string): Promise<{ success: boolean; error?: string }> {
    // TODO: 使用 nodemailer 实现
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransporter({...});
    // await transporter.sendMail({...});
    
    this.logger.log(`Email to ${email}: ${content}`);
    return { success: true };
  }

  /**
   * 发送企业微信通知
   */
  private async sendWechat(webhook: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: {
            content: content,
          },
        }),
      });

      const result = await response.json();
      
      if (result.errcode === 0) {
        this.logger.log(`Wechat notification sent successfully`);
        return { success: true };
      } else {
        this.logger.error(`Wechat notification failed: ${result.errmsg}`);
        return { success: false, error: result.errmsg };
      }
    } catch (error) {
      this.logger.error(`Wechat notification error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送钉钉通知
   */
  private async sendDingtalk(webhook: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: {
            content: content,
          },
        }),
      });

      const result = await response.json();
      
      if (result.errcode === 0) {
        this.logger.log(`Dingtalk notification sent successfully`);
        return { success: true };
      } else {
        this.logger.error(`Dingtalk notification failed: ${result.errmsg}`);
        return { success: false, error: result.errmsg };
      }
    } catch (error) {
      this.logger.error(`Dingtalk notification error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送站内消息
   */
  private async sendInternal(userId: string, content: string): Promise<{ success: boolean; error?: string }> {
    // TODO: 集成现有的站内消息服务
    this.logger.log(`Internal message to ${userId}: ${content}`);
    return { success: true };
  }
}
