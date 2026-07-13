export interface RawOpinionEvent {
  platform: string;
  title: string;
  content: string;
  author: string;
  authorAvatar?: string;
  publishTime: Date;
  url: string;
  readCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  rawData: Record<string, unknown>;
}

export interface FetchOptions {
  since?: Date;
  limit?: number;
  timeoutMs?: number;
}

export interface HealthStatus {
  healthy: boolean;
  message?: string;
  checkedAt: string;
}

export interface PlatformAdapter {
  readonly platform: string;
  readonly displayName: string;

  fetchByKeywords(keywords: string[], options: FetchOptions): Promise<RawOpinionEvent[]>;

  healthCheck(): Promise<HealthStatus>;
}
