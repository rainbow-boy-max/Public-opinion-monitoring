export interface TtsVoice {
  id: string;
  name: string;
  gender?: string;
  language?: string;
  description?: string;
  provider: string;
}

export interface TtsSynthesizeOptions {
  voiceId?: string;
  speed?: number;
  format?: 'mp3' | 'wav';
  volume?: number;
}

export interface TtsResult {
  audioBase64: string;
  durationMs: number;
  format: 'mp3' | 'wav';
  provider: string;
}

export interface TtsProvider {
  readonly name: string;
  readonly displayName: string;

  synthesize(text: string, options: TtsSynthesizeOptions): Promise<TtsResult>;
  getVoices(): TtsVoice[];
  validateConfig(): Promise<boolean>;
  updateConfig(config: Record<string, string>): void;
}
