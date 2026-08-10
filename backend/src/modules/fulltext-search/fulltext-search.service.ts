import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElasticsearchService } from '../../elasticsearch/elasticsearch.service';
import {
  OpinionEventEntity,
  ShortVideoEntity,
  WorkOrderEntity,
} from '../../database/entities';

export interface SearchResult {
  entity: string;
  id: number;
  title: string;
  snippet: string;
  url?: string;
  platform?: string;
  score?: number;
  matchedAt?: Date;
}

@Injectable()
export class FulltextSearchService {
  private readonly logger = new Logger(FulltextSearchService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(ShortVideoEntity)
    private videoRepo: Repository<ShortVideoEntity>,
    @InjectRepository(WorkOrderEntity)
    private workOrderRepo: Repository<WorkOrderEntity>,
    private readonly es: ElasticsearchService,
  ) {}

  async search(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      entities?: ('events' | 'videos' | 'workOrders')[];
    },
  ): Promise<{ results: SearchResult[]; total: number }> {
    if (this.es.isEnabled()) {
      try {
        const esResults = await this.es.search({
          query,
          limit: options?.limit,
          offset: options?.offset,
        });
        const results = esResults.map((r) => ({
          entity: r.index,
          id: parseInt(r.id, 10) || 0,
          title: r.title,
          snippet: r.snippet,
          url: (r.source.url as string) || undefined,
          platform: (r.source.platform as string) || undefined,
          score: r.score,
          matchedAt: (r.source.matchedAt as Date) || undefined,
        }));
        return { results, total: results.length };
      } catch (err) {
        this.logger.warn(`ES search failed, falling back to FULLTEXT: ${(err as Error).message}`);
      }
    }

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const entities = options?.entities ?? ['events', 'videos', 'workOrders'];

    const allResults: SearchResult[] = [];
    const BOOLEAN_QUERY = this.toBooleanQuery(query);

    if (entities.includes('events')) {
      try {
        const [rows, count] = await this.searchEvents(BOOLEAN_QUERY, limit, offset);
        allResults.push(...rows.map((r: any) => ({
          entity: 'event',
          id: r.id,
          title: r.title,
          snippet: this.highlight(r.content || r.summary, query, 150),
          url: r.url,
          platform: r.platform,
          score: r.score,
          matchedAt: r.matched_at,
        })));
      } catch (err) {
        this.logger.warn(`FULLTEXT search on events failed: ${(err as Error).message}`);
      }
    }

    if (entities.includes('videos')) {
      try {
        const rows = await this.videoRepo.query(
          `SELECT v.*, MATCH(v.title, v.description, v.ocr_text, v.asr_text) AGAINST (? IN BOOLEAN MODE) AS score
           FROM short_videos v
           WHERE MATCH(v.title, v.description, v.ocr_text, v.asr_text) AGAINST (? IN BOOLEAN MODE)
           ORDER BY score DESC LIMIT ? OFFSET ?`,
          [BOOLEAN_QUERY, BOOLEAN_QUERY, limit, offset],
        );
        allResults.push(...rows.map((r: any) => ({
          entity: 'video',
          id: r.id,
          title: r.title,
          snippet: this.highlight(r.description || r.ocr_text, query, 150),
          url: r.url,
          platform: r.platform,
          score: r.score,
          matchedAt: r.created_at,
        })));
      } catch (err) {
        this.logger.warn(`FULLTEXT search on videos failed: ${(err as Error).message}`);
      }
    }

    if (entities.includes('workOrders')) {
      try {
        const rows = await this.workOrderRepo.query(
          `SELECT w.*, MATCH(w.title, w.description) AGAINST (? IN BOOLEAN MODE) AS score
           FROM work_orders w
           WHERE MATCH(w.title, w.description) AGAINST (? IN BOOLEAN MODE)
           ORDER BY score DESC LIMIT ? OFFSET ?`,
          [BOOLEAN_QUERY, BOOLEAN_QUERY, limit, offset],
        );
        allResults.push(...rows.map((r: any) => ({
          entity: 'workOrder',
          id: r.id,
          title: r.title,
          snippet: this.highlight(r.description, query, 150),
          score: r.score,
          matchedAt: r.created_at,
        })));
      } catch (err) {
        this.logger.warn(`FULLTEXT search on work orders failed: ${(err as Error).message}`);
      }
    }

    allResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const total = allResults.length;

    return { results: allResults.slice(offset, offset + limit), total };
  }

  private async searchEvents(
    query: string,
    limit: number,
    offset: number,
  ): Promise<[any[], number]> {
    const countResult = await this.eventRepo.query(
      `SELECT COUNT(*) AS cnt FROM opinion_events e
       WHERE MATCH(e.title, e.content, e.summary) AGAINST (? IN BOOLEAN MODE)`,
      [query],
    );
    const total = Number(countResult[0]?.cnt ?? 0);

    const rows = await this.eventRepo.query(
      `SELECT e.*, MATCH(e.title, e.content, e.summary) AGAINST (? IN BOOLEAN MODE) AS score
       FROM opinion_events e
       WHERE MATCH(e.title, e.content, e.summary) AGAINST (? IN BOOLEAN MODE)
       ORDER BY score DESC LIMIT ? OFFSET ?`,
      [query, query, limit, offset],
    );
    return [rows, total];
  }

  private toBooleanQuery(raw: string): string {
    const terms = raw.trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return '';
    return terms.map((t) => `+${t}*`).join(' ');
  }

  private highlight(text: string, query: string, maxLen: number): string {
    if (!text) return '';
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return text.substring(0, maxLen);
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 80);
    const snippet = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
    return snippet.length > maxLen ? snippet.substring(0, maxLen) + '...' : snippet;
  }
}