import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { LlmModelEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    @InjectRepository(LlmModelEntity)
    private modelRepo: Repository<LlmModelEntity>,
  ) {}

  async checkVisionModels(): Promise<{ available: boolean; models: Array<{ id: number; displayName: string; provider: string }> }> {
    const models = await this.modelRepo.find({ where: { isEnabled: 1 } });
    const visionModels = models.filter(m => {
      const caps = typeof m.capabilities === 'string' ? JSON.parse(m.capabilities as string) : m.capabilities || {};
      return caps.vision === true;
    });
    return {
      available: visionModels.length > 0,
      models: visionModels.map(m => ({ id: m.id, displayName: m.displayName || m.model, provider: m.provider })),
    };
  }

  async recognizeImage(imageUrl: string): Promise<string> {
    const visionModels = (await this.checkVisionModels()).models;
    if (visionModels.length === 0) {
      return '未找到支持图片理解的 LLM 模型，请先在 LLM 模型管理中启用支持 vision 能力的模型。';
    }
    const model = await this.modelRepo.findOne({ where: { id: visionModels[0].id } });
    if (!model) throw new BadRequestException('模型不存在');

    const apiKey = CryptoUtil.decrypt(model.apiKeyEnc);
    const baseURL = `${(model.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1`;
    const client = new OpenAI({ baseURL, apiKey });

    try {
      const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
      const buffer = await resp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = resp.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const completion = await client.chat.completions.create({
        model: model.model,
        messages: [
          { role: 'system', content: '你是一个专业的 OCR 文字识别助手。请提取图片中所有可见的文字内容，按原文顺序输出。只输出识别到的文字，不要额外说明。如果图片中没有文字，请输出"未检测到文字"。' },
          { role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }] },
        ],
        max_tokens: 2048,
      });
      return completion.choices[0]?.message?.content || '识别失败';
    } catch (err) {
      this.logger.error(`OCR recognition failed: ${err}`);
      throw new BadRequestException(`图片识别失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  async recognizeVideo(videoUrl: string, frameInterval = 30): Promise<{ text: string; frames: number }> {
    this.logger.log(`Video OCR requested: ${videoUrl}, frameInterval=${frameInterval}`);
    return { text: '视频 OCR 功能需要 ffmpeg 环境支持。请先上传视频关键帧截图，使用图片 OCR 功能识别。', frames: 0 };
  }

  async getConfig(): Promise<{
    imageOcr: boolean;
    videoOcr: boolean;
    visionModels: Array<{ id: number; displayName: string; provider: string }>;
  }> {
    const info = await this.checkVisionModels();
    return {
      imageOcr: info.available,
      videoOcr: false,
      visionModels: info.models,
    };
  }
}
