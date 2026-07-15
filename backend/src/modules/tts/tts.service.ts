import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrReportEntity, PrReportStatus } from '../../database/entities';
import { TtsProvider, TtsVoice, TtsSynthesizeOptions } from './tts-provider.interface';
import { MiniMaxProvider } from './providers/minimax.provider';
import { XiaomiProvider } from './providers/xiaomi.provider';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly providers = new Map<string, TtsProvider>();
  private activeProvider: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(PrReportEntity)
    private prRepo: Repository<PrReportEntity>,
    minimax: MiniMaxProvider,
    xiaomi: XiaomiProvider,
  ) {
    this.providers.set('minimax', minimax);
    this.providers.set('xiaomi', xiaomi);
    this.activeProvider = this.configService.get<string>('TTS_PROVIDER', 'minimax');
  }

  getProviders(): Array<{ name: string; displayName: string; active: boolean }> {
    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      displayName: p.displayName,
      active: p.name === this.activeProvider,
    }));
  }

  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new ServiceUnavailableException(`不支持的 TTS 供应商: ${name}`);
    }
    this.activeProvider = name;
  }

  updateProviderConfig(name: string, config: Record<string, string>): void {
    const provider = this.providers.get(name);
    if (!provider) throw new ServiceUnavailableException(`不支持的 TTS 供应商: ${name}`);
    provider.updateConfig(config);
  }

  getProvider(name?: string): TtsProvider {
    const providerName = name || this.activeProvider;
    const provider = this.providers.get(providerName);
    if (!provider) throw new ServiceUnavailableException(`TTS 供应商 ${providerName} 不可用`);
    return provider;
  }

  async synthesize(text: string, options?: TtsSynthesizeOptions & { provider?: string }): Promise<{ audioBase64: string; durationMs: number; format: string; provider: string }> {
    const provider = this.getProvider(options?.provider);
    if (!await provider.validateConfig()) {
      throw new ServiceUnavailableException(`${provider.displayName} 未配置 API Key`);
    }
    return provider.synthesize(text, options);
  }

  async synthesizeReport(reportId: number, userId: number, options?: TtsSynthesizeOptions & { provider?: string }): Promise<{ reportId: number; audioUrl: string; durationMs: number; provider: string }> {
    const report = await this.prRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('报告不存在');
    if (report.status !== PrReportStatus.COMPLETED) {
      throw new ServiceUnavailableException('报告未完成');
    }

    const text = [report.analysis, report.strategy]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 2000);

    const result = await this.synthesize(text, options);

    const audioUrl = `data:audio/${result.format};base64,${result.audioBase64}`;
    report.audioUrl = audioUrl;
    report.audioDurationMs = result.durationMs;
    await this.prRepo.save(report);

    return { reportId, audioUrl, durationMs: result.durationMs, provider: result.provider };
  }

  getAvailableVoices(providerName?: string): TtsVoice[] {
    if (providerName) {
      const provider = this.providers.get(providerName);
      return provider ? provider.getVoices() : [];
    }
    return Array.from(this.providers.values()).flatMap(p => p.getVoices());
  }
}
