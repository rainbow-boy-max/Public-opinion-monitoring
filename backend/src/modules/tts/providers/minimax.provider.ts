import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtsProvider, TtsVoice, TtsSynthesizeOptions, TtsResult } from '../tts-provider.interface';

@Injectable()
export class MiniMaxProvider implements TtsProvider {
  readonly name = 'minimax';
  readonly displayName = 'MiniMax TTS（国内版）';

  private readonly logger = new Logger(MiniMaxProvider.name);
  private apiKey = '';
  private groupId = '';
  private endpoint = 'https://api.minimax.chat/v1/t2a_v2';

  private readonly domesticVoices: TtsVoice[] = [
    { id: 'female-shaonv', name: '少女', gender: 'female', language: '中文', description: '清新甜美的少女音', provider: 'minimax' },
    { id: 'female-yujie', name: '御姐', gender: 'female', language: '中文', description: '成熟知性的御姐音', provider: 'minimax' },
    { id: 'female-tianmei', name: '甜美', gender: 'female', language: '中文', description: '甜美亲切的女声', provider: 'minimax' },
    { id: 'female-chengshu', name: '成熟', gender: 'female', language: '中文', description: '沉稳成熟的女性声音', provider: 'minimax' },
    { id: 'male-qn-qingse', name: '青涩青年', gender: 'male', language: '中文', description: '清爽的青年男声', provider: 'minimax' },
    { id: 'male-qn-jingying', name: '精英青年', gender: 'male', language: '中文', description: '干练的精英男声', provider: 'minimax' },
    { id: 'male-qn-badao', name: '霸道青年', gender: 'male', language: '中文', description: '霸气的青年男声', provider: 'minimax' },
    { id: 'male-zhimi', name: '知米', gender: 'male', language: '中文', description: '知性温和的男性声音', provider: 'minimax' },
    { id: 'male-qingxin', name: '清新', gender: 'male', language: '中文', description: '清新明亮的男性声音', provider: 'minimax' },
    { id: 'female-qingxin', name: '清新女声', gender: 'female', language: '中文', description: '清澈的年轻女声', provider: 'minimax' },
    { id: 'female-wenrou', name: '温柔女声', gender: 'female', language: '中文', description: '温柔治愈的女声', provider: 'minimax' },
  ];

  constructor(configService: ConfigService) {
    this.apiKey = configService.get<string>('MINIMAX_TTS_API_KEY', '');
    this.groupId = configService.get<string>('MINIMAX_TTS_GROUP_ID', '');
  }

  updateConfig(config: Record<string, string>): void {
    if (config.apiKey !== undefined) this.apiKey = config.apiKey;
    if (config.groupId !== undefined) this.groupId = config.groupId;
    if (config.endpoint !== undefined) this.endpoint = config.endpoint;
  }

  async validateConfig(): Promise<boolean> {
    return !!this.apiKey;
  }

  async synthesize(text: string, options: TtsSynthesizeOptions): Promise<TtsResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('MiniMax TTS 未配置 API Key');
    }

    const voiceId = options?.voiceId || 'female-chengshu';
    const speed = Math.max(0.5, Math.min(2.0, options?.speed ?? 1.0));
    const format = options?.format || 'mp3';

    const body: Record<string, unknown> = {
      model: 'speech-02-hd',
      text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        format,
        sample_rate: 32000,
        bitrate: 128000,
        channel: 1,
      },
    };

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.groupId) {
      body.group_id = this.groupId;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`MiniMax API error: ${response.status} ${errText}`);
        throw new ServiceUnavailableException(`MiniMax TTS 合成失败: ${response.statusText}`);
      }

      const result = await response.json() as any;
      const audioBase64 = result?.data?.audio || result?.audio_base64 || '';
      const durationMs = result?.data?.duration_ms || result?.extra_info?.audio_length || 0;

      return { audioBase64, durationMs, format, provider: 'minimax' };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`MiniMax request failed: ${msg}`);
      throw new ServiceUnavailableException('MiniMax TTS 服务不可用');
    }
  }

  getVoices(): TtsVoice[] {
    return this.domesticVoices;
  }
}
