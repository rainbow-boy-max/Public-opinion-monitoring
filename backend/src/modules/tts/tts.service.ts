import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrReportEntity, PrReportStatus } from '../../database/entities';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly apiUrl = 'https://api.minimax.io/v1/t2a_v2';
  private apiKey: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(PrReportEntity)
    private prRepo: Repository<PrReportEntity>,
  ) {
    this.apiKey = this.configService.get<string>('MINIMAX_TTS_API_KEY', '');
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async synthesize(text: string, options?: {
    voiceId?: string;
    speed?: number;
    format?: 'mp3' | 'wav';
  }): Promise<{ audioBase64: string; durationMs: number }> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('TTS service not configured. Please set MINIMAX_TTS_API_KEY in environment.');
    }

    const voiceId = options?.voiceId || 'female-chengshu';
    const speed = Math.max(0.5, Math.min(2.0, options?.speed ?? 1.0));
    const format = options?.format || 'mp3';

    const body = {
      model: 'speech-2.8-hd',
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

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`MiniMax TTS API error: ${response.status} ${errText}`);
        throw new ServiceUnavailableException(`TTS synthesis failed: ${response.statusText}`);
      }

      const result = await response.json() as any;
      const audioBase64 = result?.data?.audio || result?.audio_base64 || '';
      const durationMs = result?.data?.duration_ms || result?.duration_ms || 0;

      return { audioBase64, durationMs };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TTS request failed: ${msg}`);
      throw new ServiceUnavailableException('TTS service unavailable');
    }
  }

  async synthesizeReport(reportId: number, userId: number, options?: {
    voiceId?: string;
    speed?: number;
  }): Promise<{ reportId: number; audioUrl: string; durationMs: number }> {
    const report = await this.prRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== PrReportStatus.COMPLETED) {
      throw new ServiceUnavailableException('Report is not completed yet');
    }

    const text = [report.analysis, report.strategy]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 2000);

    const { audioBase64, durationMs } = await this.synthesize(text, {
      voiceId: options?.voiceId,
      speed: options?.speed,
    });

    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

    report.audioUrl = audioUrl;
    report.audioDurationMs = durationMs;
    await this.prRepo.save(report);

    return { reportId, audioUrl, durationMs };
  }

  async getAvailableVoices(): Promise<Array<{ id: string; name: string; description: string }>> {
    return [
      { id: 'female-chengshu', name: '女声-成熟', description: '沉稳成熟的女性声音' },
      { id: 'female-tianmei', name: '女声-甜美', description: '甜美亲切的女性声音' },
      { id: 'male-zhimi', name: '男声-知米', description: '知性温和的男性声音' },
      { id: 'male-qingxin', name: '男声-清新', description: '清新明亮的男性声音' },
    ];
  }
}
