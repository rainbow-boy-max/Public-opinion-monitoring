import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbScoringConfigEntity } from '../../database/entities';
import { LlmRouterService } from '../agents/llm-router.service';
import { WebSearchService } from '../admin/web-search.service';
import { LlmModelsService } from '../agents/llm-models.service';
import type { ChatMessage } from '../agents/llm.service';

@Injectable()
export class KbScoringService {
  private readonly logger = new Logger(KbScoringService.name);

  constructor(
    @InjectRepository(KbScoringConfigEntity)
    private configRepo: Repository<KbScoringConfigEntity>,
    private llmRouterService: LlmRouterService,
    private webSearchService: WebSearchService,
    private llmModelsService: LlmModelsService,
  ) {}

  async getConfig(): Promise<{
    primaryModelId: number;
    fallbackModelIds: number[];
    enableWebSearch: boolean;
    enableVision: boolean;
    models: any[];
    updatedAt: Date | null;
  }> {
    let cfg = await this.configRepo.findOne({ where: { id: 1 } });
    if (!cfg) {
      cfg = await this.configRepo.save(
        this.configRepo.create({ id: 1, primaryModelId: 0 }),
      );
    }
    const allModels = await this.llmModelsService.list({
      page: 1,
      pageSize: 100,
    });
    return {
      primaryModelId: cfg.primaryModelId,
      fallbackModelIds: cfg.fallbackModelIds || [],
      enableWebSearch: cfg.enableWebSearch === 1,
      enableVision: cfg.enableVision === 1,
      models: allModels.items,
      updatedAt: cfg.updatedAt,
    };
  }

  async saveConfig(
    input: {
      primaryModelId?: number;
      fallbackModelIds?: number[];
      enableWebSearch?: boolean;
      enableVision?: boolean;
    },
    operatorId: number | null,
  ): Promise<void> {
    const existing = await this.configRepo.findOne({ where: { id: 1 } });
    const data = existing
      ? existing
      : this.configRepo.create({ id: 1 });
    if (input.primaryModelId !== undefined) data.primaryModelId = input.primaryModelId;
    if (input.fallbackModelIds !== undefined) data.fallbackModelIds = input.fallbackModelIds;
    if (input.enableWebSearch !== undefined) data.enableWebSearch = input.enableWebSearch ? 1 : 0;
    if (input.enableVision !== undefined) data.enableVision = input.enableVision ? 1 : 0;
    data.updatedBy = operatorId;
    await this.configRepo.save(data);
  }

  /**
   * 智能打分：根据配置选择模型 + 决定是否用 webSearch/vision
   * 返回 { score, summary, topics, qaPairs, debug }
   */
  async scoreDocument(input: {
    filename: string;
    fileContent: string;
    kbName: string;
    kbDomain: string;
    kbTags: string[];
    filePath: string;
  }): Promise<{
    score: number;
    summary: string;
    topics: string[];
    qaPairs: Array<{ q: string; a: string }>;
    debug: Record<string, unknown>;
  }> {
    const cfg = await this.getConfig();
    const debug: Record<string, unknown> = {};
    const text = input.fileContent.substring(0, 3000);

    // 1. Web Search 增强（可选）
    let webSnippets = '';
    if (cfg.enableWebSearch) {
      try {
        const results = await this.webSearchService.search(input.kbName);
        debug.webSearchResults = (results || []).slice(0, 3).map((r) => r.title);
        if (results && results.length > 0) {
          webSnippets = '\n[外部参考信息]\n' + results
            .map((r) => `- ${r.title} (${r.snippet?.slice(0, 200) || ''})`)
            .slice(0, 3)
            .join('\n');
        }
      } catch (err) {
        this.logger.warn(`Web search failed for scoring: ${(err as Error).message}`);
        debug.webSearchError = (err as Error).message;
      }
    }

    // 2. 构建打分 prompt
    const prompt = `你是内容相关性分析专家。请严格按 JSON 格式回答：

{
  "score": 0-100,
  "summary": "50-100 字摘要",
  "topics": ["主题1", "主题2"],
  "qaPairs": [{"q":"问题1","a":"答案1"}, {"q":"问题2","a":"答案2"}]
}

评估标准：
- score：文档与知识库「${input.kbName}」（领域：${input.kbDomain}，标签：${(input.kbTags || []).join(', ') || '通用'}）的相关性评分
  - 0-20：完全不相关或纯广告/垃圾内容
  - 21-50：部分相关但信息稀疏
  - 51-80：相关且信息密度中等
  - 81-100：高度相关，信息密度大，结构清晰
- summary：内容摘要
- topics：文档的主题
- qaPairs：3 个常见问答
${webSnippets}

文件名：${input.filename}

文档内容预览（前 3000 字）：
${text}`;

    // 3. 调用 LLM
    const messages: ChatMessage[] = [
      { role: 'system', content: '你是内容相关性分析专家，严格返回 JSON。' },
      { role: 'user', content: prompt },
    ];

    const modelIds = [
      cfg.primaryModelId,
      ...(cfg.fallbackModelIds || []),
    ].filter(Boolean);

    if (modelIds.length === 0) {
      debug.error = '未配置打分模型';
      return {
        score: 0,
        summary: '',
        topics: [],
        qaPairs: [],
        debug,
      };
    }

    try {
      const result = await this.llmRouterService.chat({
        primaryModelId: cfg.primaryModelId,
        fallbackModelIds: cfg.fallbackModelIds || [],
        messages,
        temperature: 0.3,
        maxTokens: 1500,
      });

      debug.modelUsed = result.modelUsed;
      debug.latencyMs = result.totalLatencyMs;

      const json = this.tryParseJson(result.content);
      if (json && typeof json.score === 'number') {
        return {
          score: Math.max(0, Math.min(100, (json.score as number))),
          summary: String(json.summary || ''),
          topics: Array.isArray(json.topics) ? (json.topics as string[]).slice(0, 10) : [],
          qaPairs: Array.isArray(json.qaPairs) ? (json.qaPairs as Array<{ q: string; a: string }>).slice(0, 10) : [],
          debug,
        };
      }
      debug.parseError = 'JSON 解析失败';
    } catch (err) {
      this.logger.warn(`Score AI error: ${(err as Error).message}`);
      debug.error = (err as Error).message;
    }

    return { score: 0, summary: '', topics: [], qaPairs: [], debug };
  }

  private tryParseJson(content: string): Record<string, unknown> | null {
    try {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) return null;
      return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    } catch {
      return null;
    }
  }
}
