import { Injectable, Logger, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

export interface EsSearchOptions {
  query: string;
  index?: string[];
  limit?: number;
  offset?: number;
  filters?: Record<string, string | number>;
  sort?: string;
}

export interface EsSearchResult {
  id: string;
  index: string;
  score: number;
  title: string;
  snippet: string;
  source: Record<string, unknown>;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const node = this.config.get<string>('ES_NODE') || process.env.ES_NODE;
    if (!node) {
      this.logger.warn('ES_NODE not configured, Elasticsearch disabled. Falling back to MariaDB FULLTEXT.');
      return;
    }

    try {
      this.client = new Client({
        node,
        auth: {
          username: this.config.get<string>('ES_USERNAME') || process.env.ES_USERNAME || 'elastic',
          password: this.config.get<string>('ES_PASSWORD') || process.env.ES_PASSWORD || '',
        },
        requestTimeout: 10000,
      });
      await this.client.ping();
      this.enabled = true;
      this.logger.log(`Connected to Elasticsearch at ${node}`);

      await this.ensureIndex('opinion_events');
      await this.ensureIndex('short_videos');
      await this.ensureIndex('work_orders');
    } catch (err) {
      this.logger.warn(`Elasticsearch unavailable: ${(err as Error).message}. Falling back to MariaDB FULLTEXT.`);
    }
  }

  async onApplicationShutdown() {
    if (this.client) {
      await this.client.close();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getClient(): Client | null {
    return this.enabled ? this.client : null;
  }

  async indexDocument(index: string, id: string, body: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.index({ index, id, body, refresh: false });
    } catch (err) {
      this.logger.warn(`ES index failed: ${(err as Error).message}`);
    }
  }

  async bulkIndex(
    index: string,
    documents: Array<{ id: string; body: Record<string, unknown> }>,
  ): Promise<void> {
    if (!this.enabled || documents.length === 0) return;
    try {
      const operations = documents.flatMap((doc) => [
        { index: { _index: index, _id: doc.id } },
        doc.body,
      ]);
      await this.client.bulk({ operations, refresh: false });
      this.logger.debug(`Bulk indexed ${documents.length} docs to ${index}`);
    } catch (err) {
      this.logger.warn(`ES bulk index failed: ${(err as Error).message}`);
    }
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete({ index, id });
    } catch (err) {
      this.logger.warn(`ES delete failed: ${(err as Error).message}`);
    }
  }

  async search(options: EsSearchOptions): Promise<EsSearchResult[]> {
    if (!this.enabled) return [];

    const indices = options.index || ['opinion_events', 'short_videos', 'work_orders'];
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const must: any[] = [{ query_string: { query: options.query, default_operator: 'AND' } }];

    if (options.filters) {
      for (const [field, value] of Object.entries(options.filters)) {
        must.push({ term: { [field]: value } });
      }
    }

    try {
      const result = await this.client.search({
        index: indices,
        from: offset,
        size: limit,
        sort: options.sort ? [options.sort] : ['_score'],
        query: { bool: { must } },
        _source: true,
      });

      return result.hits.hits.map((hit: any) => ({
        id: hit._id,
        index: hit._index,
        score: hit._score || 0,
        title: (hit._source as any)?.title || '',
        snippet: ((hit._source as any)?.content || (hit._source as any)?.summary || '').substring(0, 200),
        source: hit._source as Record<string, unknown>,
      }));
    } catch (err) {
      this.logger.warn(`ES search failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async ensureIndex(index: string): Promise<void> {
    const exists = await this.client.indices.exists({ index });
    if (!exists) {
      await this.client.indices.create({
        index,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: {
            properties: {
              title: { type: 'text', analyzer: 'ik_max_word' },
              content: { type: 'text', analyzer: 'ik_max_word' },
              summary: { type: 'text', analyzer: 'ik_smart' },
              platform: { type: 'keyword' },
              author: { type: 'keyword' },
              sentiment: { type: 'keyword' },
              matchedKeywords: { type: 'keyword' },
              publishTime: { type: 'date' },
              matchedAt: { type: 'date' },
              taskId: { type: 'long' },
              status: { type: 'integer' },
              url: { type: 'keyword', index: false },
            },
          },
        },
      });
      this.logger.log(`Created ES index: ${index}`);
    }
  }
}