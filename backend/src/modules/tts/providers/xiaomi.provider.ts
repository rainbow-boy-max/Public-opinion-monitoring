import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtsProvider, TtsVoice, TtsSynthesizeOptions, TtsResult } from '../tts-provider.interface';

@Injectable()
export class XiaomiProvider implements TtsProvider {
  readonly name = 'xiaomi';
  readonly displayName = '小米 MiMo 语音合成';

  private readonly logger = new Logger(XiaomiProvider.name);
  private apiKey = '';
  private readonly endpoint = 'https://api.xiaomimimo.com/v1/chat/completions';

  private readonly voices: TtsVoice[] = [
    { id: 'mimo_default', name: 'MiMo-默认', gender: 'female', language: '中文/英文', description: '默认精品音色（冰糖/Mia）', provider: 'xiaomi' },
    { id: '冰糖', name: '冰糖', gender: 'female', language: '中文', description: '清亮甜美的女声', provider: 'xiaomi' },
    { id: '茉莉', name: '茉莉', gender: 'female', language: '中文', description: '温柔优雅的女声', provider: 'xiaomi' },
    { id: '苏打', name: '苏打', gender: 'male', language: '中文', description: '清爽活力的男声', provider: 'xiaomi' },
    { id: '白桦', name: '白桦', gender: 'male', language: '中文', description: '沉稳磁性的男声', provider: 'xiaomi' },
    { id: 'Mia', name: 'Mia', gender: 'female', language: '英文', description: 'Native English female voice', provider: 'xiaomi' },
    { id: 'Chloe', name: 'Chloe', gender: 'female', language: '英文', description: 'Bright English female voice', provider: 'xiaomi' },
    { id: 'Milo', name: 'Milo', gender: 'male', language: '英文', description: 'Warm English male voice', provider: 'xiaomi' },
    { id: 'Dean', name: 'Dean', gender: 'male', language: '英文', description: 'Deep English male voice', provider: 'xiaomi' },
  ];

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('MIMO_TTS_API_KEY', '');
  }

  updateConfig(config: Record<string, string>): void {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
  }

  async validateConfig(): Promise<boolean> {
    return !!this.apiKey;
  }

  async synthesize(text: string, options: TtsSynthesizeOptions): Promise<TtsResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('小米 TTS 未配置 API Key');
    }

    const voiceId = options?.voiceId || '冰糖';
    const format = options?.format || 'mp3';
    const speed = Math.max(0.5, Math.min(2.0, options?.speed ?? 1.0));

    const body = {
      model: 'mimo-v2.5-tts',
      messages: [
        {
          role: 'user',
          content: `请用沉稳专业的语调进行新闻播报，语速${speed >= 1.2 ? '偏快' : speed <= 0.8 ? '偏慢' : '适中'}。`,
        },
        {
          role: 'assistant',
          content: text,
        },
      ],
      audio: {
        format: format === 'mp3' ? 'mp3' : 'wav',
        voice: voiceId,
      },
    };

    const headers: Record<string, string> = {
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`Xiaomi TTS API error: ${response.status} ${errText}`);
        throw new ServiceUnavailableException(`小米 TTS 合成失败: ${response.statusText}`);
      }

      const result = await response.json() as any;
      const audioData = result?.choices?.[0]?.message?.audio?.data;
      if (!audioData) {
        throw new ServiceUnavailableException('小米 TTS 返回数据异常');
      }

      return {
        audioBase64: audioData,
        durationMs: 0,
        format,
        provider: 'xiaomi',
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Xiaomi request failed: ${msg}`);
      throw new ServiceUnavailableException('小米 TTS 服务不可用');
    }
  }

  getVoices(): TtsVoice[] {
    return this.voices;
  }
}
