import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmModelEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';
import { LlmService, ChatMessage } from './llm.service';
import { AuditService } from '../admin/audit.service';

const PRESET_PROVIDERS = [
  {
    provider: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { model: 'gpt-4o', displayName: 'GPT-4o （多模态旗舰）' },
      { model: 'gpt-4o-mini', displayName: 'GPT-4o mini （高性价比）' },
      { model: 'gpt-4-turbo', displayName: 'GPT-4 Turbo' },
      { model: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo' },
    ],
  },
  {
    provider: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { model: 'deepseek-chat', displayName: 'DeepSeek-V3 （通用对话）' },
      { model: 'deepseek-coder', displayName: 'DeepSeek-Coder （代码专精）' },
      { model: 'deepseek-reasoner', displayName: 'DeepSeek-R1 （推理专精）' },
    ],
  },
  {
    provider: 'dashscope',
    displayName: '阿里云百炼 通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { model: 'qwen-max', displayName: '通义千问 Qwen-Max （最强）' },
      { model: 'qwen-plus', displayName: '通义千问 Qwen-Plus' },
      { model: 'qwen-turbo', displayName: '通义千问 Qwen-Turbo （快速）' },
      { model: 'qwen-long', displayName: '通义千问 Qwen-Long （长文）' },
    ],
  },
  {
    provider: 'zhipu',
    displayName: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { model: 'glm-4-plus', displayName: '智谱 GLM-4 Plus （旗舰）' },
      { model: 'glm-4-flash', displayName: '智谱 GLM-4 Flash （极速）' },
      { model: 'glm-4-air', displayName: '智谱 GLM-4 Air' },
      { model: 'glm-4-airx', displayName: '智谱 GLM-4 AirX' },
    ],
  },
  {
    provider: 'moonshot',
    displayName: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { model: 'moonshot-v1-128k', displayName: 'Kimi 128K （超长上下文）' },
      { model: 'moonshot-v1-32k', displayName: 'Kimi 32K' },
      { model: 'moonshot-v1-8k', displayName: 'Kimi 8K （快速）' },
    ],
  },
  {
    provider: 'siliconflow',
    displayName: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      { model: 'deepseek-ai/DeepSeek-V3', displayName: 'SiliconFlow · DeepSeek-V3' },
      { model: 'Qwen/Qwen2.5-72B-Instruct', displayName: 'SiliconFlow · Qwen2.5-72B' },
      { model: 'Qwen/Qwen2.5-32B-Instruct', displayName: 'SiliconFlow · Qwen2.5-32B' },
      { model: 'THUDM/glm-4-9b-chat', displayName: 'SiliconFlow · GLM-4-9B' },
    ],
  },
];

const PLACEHOLDER_ENCRYPTED = '__PLACEHOLDER_NEED_USER_INPUT__';

export interface ModelCapabilities {
  vision: boolean;
  reasoning: boolean;
  webSearch: boolean;
}

export function inferCapabilities(modelName: string): ModelCapabilities {
  const lower = (modelName || '').toLowerCase();
  const vision = /vision|gpt-4o|qwen-vl|glm-4v|claude-3|claude-4|gemini-1\.5|gemini-2|grok-vision|qvq/.test(
    lower,
  );
  const reasoning = /reasoner|-r1|^r1|o1|o3|thinking|qwq|deepseek-r1/.test(lower);
  return { vision, reasoning, webSearch: false };
}

@Injectable()
export class LlmModelsService implements OnModuleInit {
  private readonly logger = new Logger(LlmModelsService.name);

  constructor(
    @InjectRepository(LlmModelEntity)
    private repo: Repository<LlmModelEntity>,
    private llmService: LlmService,
    private auditService: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      for (const p of PRESET_PROVIDERS) {
        for (const m of p.models) {
          const existing = await this.repo.findOne({
            where: { provider: p.provider, model: m.model },
          });
          if (!existing) {
            await this.repo.save(
              this.repo.create({
                provider: p.provider,
                model: m.model,
                displayName: m.displayName,
                baseUrl: p.baseUrl,
                apiKeyEnc: PLACEHOLDER_ENCRYPTED,
                apiVersion: '1.0',
                maxTokens: 4096,
                isPreset: 1,
                isEnabled: 1,
                capabilities: inferCapabilities(m.model) as any,
              }),
            );
            this.logger.log(`Seed preset model: ${p.provider}/${m.model} (待配置 API Key)`);
          } else if (!existing.capabilities) {
            existing.capabilities = inferCapabilities(m.model) as any;
            await this.repo.save(existing);
            this.logger.log(`Backfill capabilities: ${p.provider}/${m.model}`);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`LLM preset seeding skipped: ${(err as Error).message}`);
    }
  }

  async list(params: {
    page: number;
    pageSize: number;
    provider?: string;
    search?: string;
  }): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, provider, search } = params;
    const qb = this.repo.createQueryBuilder('m');
    if (provider) qb.andWhere('m.provider = :provider', { provider });
    if (search) {
      const q = `%${search}%`;
      qb.andWhere('(m.display_name LIKE :q OR m.model LIKE :q OR m.provider LIKE :q)', { q });
    }
    qb.orderBy('m.isPreset', 'DESC')
      .addOrderBy('m.provider', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((m) => ({
        id: m.id,
        provider: m.provider,
        model: m.model,
        displayName: m.displayName,
        baseUrl: m.baseUrl,
        apiVersion: m.apiVersion,
        maxTokens: m.maxTokens,
        isPreset: m.isPreset === 1,
        isEnabled: m.isEnabled === 1,
        apiKeyMasked: this.maskApiKey(m.apiKeyEnc),
        apiKeyConfigured: m.apiKeyEnc !== PLACEHOLDER_ENCRYPTED,
        lastTestedAt: m.lastTestedAt,
        lastTestStatus: m.lastTestStatus,
        capabilities: m.capabilities ?? inferCapabilities(m.model),
      })),
      total,
      page,
      pageSize,
    };
  }

  async listPresets(): Promise<Array<{ provider: string; displayName: string; baseUrl: string; models: any[] }>> {
    return PRESET_PROVIDERS.map((p) => ({
      provider: p.provider,
      displayName: p.displayName,
      baseUrl: p.baseUrl,
      models: p.models,
    }));
  }

  async getOne(id: number): Promise<any> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('模型不存在');
    return {
      ...m,
      apiKeyMasked: this.maskApiKey(m.apiKeyEnc),
      apiKeyConfigured: m.apiKeyEnc !== PLACEHOLDER_ENCRYPTED,
      _plainApiKey: undefined,
    };
  }

  async save(dto: any): Promise<any> {
    let entity: LlmModelEntity;
    const existing = await this.repo.findOne({
      where: { provider: dto.provider, model: dto.model },
    });
    if (existing) {
      entity = existing;
      this.applyDto(entity, dto);
    } else {
      entity = this.repo.create({
        isPreset: dto.isPreset === true ? 1 : 0,
      });
      this.applyDto(entity, dto);
    }
    const saved = await this.repo.save(entity);
    const apiKeyPlain = dto.apiKey;
    await this.auditService.record({
      actorType: 'admin',
      module: 'llm-models',
      action: existing ? 'update' : 'create',
      resourceType: 'llm-model',
      resourceId: saved.id,
      title: `${existing ? '更新' : '创建'}模型：${saved.provider}/${saved.model}`,
    });
    return {
      id: saved.id,
      provider: saved.provider,
      model: saved.model,
      apiKeyConfigured: !!apiKeyPlain && apiKeyPlain !== PLACEHOLDER_ENCRYPTED,
      message: '保存成功',
    };
  }

  async update(id: number, dto: any): Promise<any> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('模型不存在');
    this.applyDto(m, dto);
    await this.repo.save(m);
    await this.auditService.record({
      actorType: 'admin',
      module: 'llm-models',
      action: 'update',
      resourceType: 'llm-model',
      resourceId: m.id,
      title: `更新模型配置：${m.provider}/${m.model}`,
    });
    return { id: m.id, message: '更新成功' };
  }

  async remove(id: number): Promise<void> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('模型不存在');
    if (m.isPreset === 1) {
      throw new BadRequestException('预置模型不可删除，但可禁用或更新 API Key');
    }
    await this.repo.remove(m);
    await this.auditService.record({
      actorType: 'admin',
      module: 'llm-models',
      action: 'delete',
      resourceType: 'llm-model',
      resourceId: id,
      title: `删除模型：${m.provider}/${m.model}`,
    });
  }

  async testConnection(id: number, prompt?: string): Promise<{
    ok: boolean;
    message: string;
    latencyMs: number;
    output?: string;
    error?: string;
  }> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('模型不存在');
    if (m.isEnabled !== 1) throw new BadRequestException('模型已禁用');
    if (m.apiKeyEnc === PLACEHOLDER_ENCRYPTED) throw new BadRequestException('请先配置 API Key');

    const apiKey = CryptoUtil.decrypt(m.apiKeyEnc);
    const start = Date.now();
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个测试助手，请用一句话回应。' },
        { role: 'user', content: prompt || '请说 "OK"。' },
      ];
      const resp = await this.llmService.chat({
        model: m.model,
        baseUrl: m.baseUrl,
        apiKey,
        messages,
        temperature: 0.1,
        maxTokens: 100,
      });
      const latencyMs = Date.now() - start;
      m.lastTestedAt = new Date();
      m.lastTestStatus = 'success';
      await this.repo.save(m);
      await this.auditService.record({
        actorType: 'admin',
        module: 'llm-models',
        action: 'test-success',
        resourceType: 'llm-model',
        resourceId: m.id,
        title: `测试模型成功：${m.provider}/${m.model}（${latencyMs}ms）`,
      });
      return {
        ok: true,
        message: '连接成功',
        latencyMs,
        output: resp.content,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      m.lastTestedAt = new Date();
      m.lastTestStatus = 'failed';
      await this.repo.save(m);
      const msg = err instanceof Error ? err.message : String(err);
      await this.auditService.record({
        actorType: 'admin',
        module: 'llm-models',
        action: 'test-fail',
        resourceType: 'llm-model',
        resourceId: m.id,
        title: `测试模型失败：${m.provider}/${m.model}`,
        content: msg,
      });
      return {
        ok: false,
        message: '连接失败',
        latencyMs,
        error: msg,
      };
    }
  }

  async fetchModels(baseUrl: string, apiKey: string): Promise<{ models: string[]; count: number }> {
    if (!baseUrl || !apiKey) {
      throw new BadRequestException('请填写 Base URL 和 API Key');
    }
    const models = await this.llmService.listModels(baseUrl, apiKey);
    return { models, count: models.length };
  }

  private applyDto(entity: LlmModelEntity, dto: any): void {
    if (dto.provider) entity.provider = dto.provider;
    if (dto.model) entity.model = dto.model;
    if (dto.displayName) entity.displayName = dto.displayName;
    if (dto.baseUrl) entity.baseUrl = dto.baseUrl;
    if (dto.apiKey && dto.apiKey !== '********') {
      entity.apiKeyEnc = CryptoUtil.encrypt(dto.apiKey);
    }
    if (dto.apiVersion) entity.apiVersion = dto.apiVersion;
    if (typeof dto.maxTokens === 'number') entity.maxTokens = dto.maxTokens;
    if (typeof dto.isEnabled === 'boolean') entity.isEnabled = dto.isEnabled ? 1 : 0;
    if (
      dto.vision !== undefined ||
      dto.reasoning !== undefined ||
      dto.webSearch !== undefined
    ) {
      const base = (entity.capabilities as any) || inferCapabilities(entity.model || dto.model || '');
      entity.capabilities = {
        vision:
          dto.vision !== undefined ? !!dto.vision : base.vision === true,
        reasoning:
          dto.reasoning !== undefined ? !!dto.reasoning : base.reasoning === true,
        webSearch:
          dto.webSearch !== undefined ? !!dto.webSearch : base.webSearch === true,
      } as any;
    } else if (!entity.capabilities) {
      entity.capabilities = inferCapabilities(entity.model) as any;
    }
  }

  private maskApiKey(enc: string): string {
    if (!enc || enc === PLACEHOLDER_ENCRYPTED) return '未配置';
    try {
      const plain = CryptoUtil.decrypt(enc);
      if (plain.length <= 8) return '***';
      return plain.substring(0, 4) + '****' + plain.substring(plain.length - 4);
    } catch {
      return '***';
    }
  }
}
