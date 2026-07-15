import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmModelEntity } from '../../database/entities';
import { LlmRouterService } from '../agents/llm-router.service';

export interface KeywordItem {
  word: string;
  type: 'synonym' | 'broader' | 'narrower' | 'related';
  score: number;
  reason: string;
}

export interface KeywordSuggestion {
  keywords: KeywordItem[];
  error?: string;
}

@Injectable()
export class KeywordSuggestService {
  private readonly logger = new Logger(KeywordSuggestService.name);

  constructor(
    @InjectRepository(LlmModelEntity)
    private llmModelRepo: Repository<LlmModelEntity>,
    private llmRouterService: LlmRouterService,
  ) {}

  async suggestRelated(baseKeywords: string[], count: number = 10): Promise<KeywordSuggestion> {
    const models = await this.llmModelRepo.find({
      where: { isEnabled: 1 },
      order: { sortOrder: 'ASC' },
    });
    const enabledModels = models.filter((m) => {
      const hasKey = m.apiKeyEnc && m.apiKeyEnc !== '__PLACEHOLDER_NEED_USER_INPUT__';
      return hasKey;
    });

    if (enabledModels.length === 0) {
      return { keywords: [], error: 'LLM_NOT_CONFIGURED' };
    }

    const prompt = `你是SEO关键词拓展专家。请根据以下种子关键词，推荐${count}个相关的拓展关键词（包括同义词、上下义词、相关概念）。返回JSON格式：{ keywords: [{ word: string, type: 'synonym'|'broader'|'narrower'|'related', score: number, reason: string }] }. 种子词：${baseKeywords.join(', ')}`;

    try {
      const result = await this.llmRouterService.chat({
        primaryModelId: enabledModels[0].id,
        fallbackModelIds: enabledModels.slice(1).map((m) => m.id),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        maxTokens: 2000,
      });

      const content = result.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { keywords: [], error: 'LLM_RESPONSE_PARSE_FAILED' };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return { keywords: parsed.keywords || [] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Keyword suggest failed: ${msg}`);
      return { keywords: [], error: msg };
    }
  }
}
