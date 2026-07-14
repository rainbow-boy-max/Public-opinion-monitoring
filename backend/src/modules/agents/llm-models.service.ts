import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LlmModelEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';
import { LlmService, ChatMessage } from './llm.service';
import { AuditService } from '../admin/audit.service';

const PRESET_PROVIDERS: Array<{
  provider: string;
  displayName: string;
  baseUrl: string;
  apiStyle: 'openai' | 'anthropic';
  models: Array<{ model: string; displayName: string }>;
}> = [
  {
    provider: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiStyle: 'openai',
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
    apiStyle: 'openai',
    models: [
      { model: 'deepseek-chat', displayName: 'DeepSeek-V3.2 （通用对话）' },
      { model: 'deepseek-coder', displayName: 'DeepSeek-Coder （代码专精）' },
      { model: 'deepseek-reasoner', displayName: 'DeepSeek-R1 （推理专精）' },
    ],
  },
  {
    provider: 'deepseek_anthropic',
    displayName: 'DeepSeek (Anthropic 兼容)',
    baseUrl: 'https://api.deepseek.com/anthropic',
    apiStyle: 'anthropic',
    models: [
      { model: 'deepseek-chat', displayName: 'DeepSeek-V3.2 (Anthropic)' },
      { model: 'deepseek-reasoner', displayName: 'DeepSeek-R1 (Anthropic 推理)' },
    ],
  },
  {
    provider: 'dashscope',
    displayName: '阿里云百炼 通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiStyle: 'openai',
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
    apiStyle: 'openai',
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
    apiStyle: 'openai',
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
    apiStyle: 'openai',
    models: [
      { model: 'deepseek-ai/DeepSeek-V3', displayName: 'SiliconFlow · DeepSeek-V3' },
      { model: 'Qwen/Qwen2.5-72B-Instruct', displayName: 'SiliconFlow · Qwen2.5-72B' },
      { model: 'Qwen/Qwen2.5-32B-Instruct', displayName: 'SiliconFlow · Qwen2.5-32B' },
      { model: 'THUDM/glm-4-9b-chat', displayName: 'SiliconFlow · GLM-4-9B' },
    ],
  },
  {
    provider: 'minimax',
    displayName: 'MiniMax（国内 minimaxi.com）',
    baseUrl: 'https://api.minimaxi.com/v1',
    apiStyle: 'openai',
    models: [
      { model: 'MiniMax-M3', displayName: 'MiniMax-M3 (1M context · 多模态)' },
      { model: 'MiniMax-M2.7', displayName: 'MiniMax-M2.7 (推理)' },
      { model: 'MiniMax-M2.7-highspeed', displayName: 'MiniMax-M2.7-highspeed (高速)' },
      { model: 'MiniMax-M2.5', displayName: 'MiniMax-M2.5' },
      { model: 'MiniMax-M2.5-highspeed', displayName: 'MiniMax-M2.5-highspeed' },
      { model: 'MiniMax-M2.1', displayName: 'MiniMax-M2.1' },
      { model: 'MiniMax-M2.1-highspeed', displayName: 'MiniMax-M2.1-highspeed' },
      { model: 'MiniMax-M2', displayName: 'MiniMax-M2' },
    ],
  },
  {
    provider: 'minimax_anthropic',
    displayName: 'MiniMax Anthropic 兼容（国内 minimaxi.com）',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    apiStyle: 'anthropic',
    models: [
      { model: 'MiniMax-M3', displayName: 'MiniMax-M3 (Anthropic · vision+reasoning)' },
      { model: 'MiniMax-M2.7', displayName: 'MiniMax-M2.7 (Anthropic · reasoning)' },
      { model: 'MiniMax-M2.5', displayName: 'MiniMax-M2.5 (Anthropic)' },
      { model: 'MiniMax-M2.1', displayName: 'MiniMax-M2.1 (Anthropic)' },
      { model: 'MiniMax-M2', displayName: 'MiniMax-M2 (Anthropic)' },
    ],
  },
];

const PLACEHOLDER_ENCRYPTED = '__PLACEHOLDER_NEED_USER_INPUT__';

export interface ModelCapabilities {
  vision: boolean;
  reasoning: boolean;
  webSearch: boolean;
}

export function inferCapabilities(
  modelName: string,
  provider?: string,
  apiStyle: 'openai' | 'anthropic' = 'openai',
): ModelCapabilities {
  const lower = (modelName || '').toLowerCase();
  const isAnthropicPath = apiStyle === 'anthropic';
  const providerLower = (provider || '').toLowerCase();

  // Vision: 模型名命中视觉模型；MiniMax-M3 在 Anthropic 兼容端点下暴露 image/video content block
  const vision =
    /vision|gpt-4o|qwen-vl|qvq/.test(lower) ||
    (lower === 'minimax-m3' && isAnthropicPath) ||
    (providerLower === 'minimax_anthropic' && lower === 'minimax-m3');

  // Reasoning: 模型名命中推理模型；Anthropic 路径下 MiniMax-M3/M2.x 暴露 thinking 块
  const reasoning =
    /reasoner|-r1|^r1|^o1|^o3|thinking|qwq|deepseek-r1/.test(lower) ||
    (providerLower === 'minimax_anthropic' &&
      /^minimax-m(3|2\.7|2\.5|2\.1|2$)/.test(lower)) ||
    (lower === 'minimax-m3' && isAnthropicPath);

  return { vision, reasoning, webSearch: false };
}

export type EffectiveState =
  | 'enabled'
  | 'disabled'
  | 'disabled_pending_key'
  | 'enabled_force';

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
      const existing = await this.repo.find();
      const maxSort = existing.reduce((m, r) => Math.max(m, r.sortOrder || 0), 0);
      let nextSort = maxSort + 10;
      for (const p of PRESET_PROVIDERS) {
        for (const m of p.models) {
          const found = existing.find(
            (r) => r.provider === p.provider && r.model === m.model,
          );
          if (!found) {
            const caps = inferCapabilities(m.model, p.provider, p.apiStyle);
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
                isEnabled: 0,
                capabilities: caps as any,
                apiStyle: p.apiStyle,
                sortOrder: nextSort,
              } as any),
            );
            this.logger.log(
              `Seed preset model: ${p.provider}/${m.model} (apiStyle=${p.apiStyle})`,
            );
            nextSort += 10;
          } else if (!found.capabilities || (found.apiStyle as any) !== p.apiStyle) {
            // backfill capabilities / apiStyle on existing rows
            const caps = inferCapabilities(m.model, p.provider, p.apiStyle);
            found.capabilities = caps as any;
            found.apiStyle = p.apiStyle;
            await this.repo.save(found);
            this.logger.log(
              `Backfill ${p.provider}/${m.model} (apiStyle=${p.apiStyle})`,
            );
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
    qb.orderBy('m.sort_order', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((m) => this.serialize(m)),
      total,
      page,
      pageSize,
    };
  }

  async listPresets(): Promise<any[]> {
    return PRESET_PROVIDERS.map((p) => ({
      provider: p.provider,
      displayName: p.displayName,
      baseUrl: p.baseUrl,
      apiStyle: p.apiStyle,
      models: p.models,
    }));
  }

  async getOne(id: number): Promise<any> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('模型不存在');
    return this.serialize(m);
  }

  async save(dto: any): Promise<any> {
    const existing = await this.repo.findOne({
      where: { provider: dto.provider, model: dto.model },
    });
    const apiStyle = (dto.apiStyle as 'openai' | 'anthropic') || 'openai';
    if (apiStyle !== 'openai' && apiStyle !== 'anthropic') {
      throw new BadRequestException('LLM_INVALID_API_STYLE');
    }
    const entity = existing
      ? existing
      : this.repo.create({ isPreset: dto.isPreset === true ? 1 : 0 });
    this.applyDto(entity, dto);
    entity.apiStyle = apiStyle;
    this.applyIsEnabledByKey(entity, dto, /*existing*/ !!existing);
    if (!existing) {
      if (entity.sortOrder === undefined || entity.sortOrder === null) {
        const max = await this.repo
          .createQueryBuilder('m')
          .select('MAX(m.sort_order)', 'm')
          .getRawOne<{ m: number }>();
        entity.sortOrder = (max?.m || 0) + 10;
      }
    }
    const saved = await this.repo.save(entity);
    return this.serialize(saved);
  }

  async update(id: number, dto: any): Promise<any> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('模型不存在');
    if (dto.apiStyle !== undefined) {
      if (dto.apiStyle !== 'openai' && dto.apiStyle !== 'anthropic') {
        throw new BadRequestException('LLM_INVALID_API_STYLE');
      }
      m.apiStyle = dto.apiStyle;
    }
    this.applyDto(m, dto);
    this.applyIsEnabledByKey(m, dto, /*existing*/ true);
    await this.repo.save(m);
    return this.serialize(m);
  }

  async remove(id: number): Promise<void> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('模型不存在');
    if (m.isPreset === 1) {
      // 允许删除预置，但下次 init-presets 不会自动复活（避免覆盖用户修改）
      this.logger.log(`Deleted preset model id=${id} (${m.provider}/${m.model})`);
    }
    await this.repo.remove(m);
  }

  async batch(input: { ids: number[]; isEnabled: boolean; force?: boolean }): Promise<{
    ok: boolean;
    successIds: number[];
    skipped: Array<{ id: number; errorCode: string; message: string }>;
    failed: Array<{ id: number; errorCode: string; message: string }>;
  }> {
    const { ids, isEnabled, force } = input;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids 不能为空');
    }
    const models = await this.repo.find({ where: { id: In(ids) } });
    const successIds: number[] = [];
    const skipped: Array<{ id: number; errorCode: string; message: string }> = [];
    const failed: Array<{ id: number; errorCode: string; message: string }> = [];
    for (const m of models) {
      const hasKey = m.apiKeyEnc && m.apiKeyEnc !== PLACEHOLDER_ENCRYPTED;
      if (isEnabled && !hasKey && !force) {
        skipped.push({
          id: m.id,
          errorCode: 'LLM_KEY_REQUIRED',
          message: `${m.provider}/${m.model} 未配置 API Key`,
        });
        continue;
      }
      m.isEnabled = isEnabled ? 1 : 0;
      try {
        await this.repo.save(m);
        successIds.push(m.id);
      } catch (err) {
        failed.push({
          id: m.id,
          errorCode: 'LLM_BATCH_UPDATE_FAILED',
          message: (err as Error).message,
        });
      }
    }
    return { ok: failed.length === 0, successIds, skipped, failed };
  }

  async reorder(input: { id: number; sortOrder: number }): Promise<void> {
    const target = await this.repo.findOne({ where: { id: input.id } });
    if (!target) throw new NotFoundException('模型不存在');
    const newOrder = Math.max(0, Math.floor(input.sortOrder));
    const all = await this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const ids = all.map((m) => m.id);
    const without = ids.filter((i) => i !== input.id);
    const next = [...without.slice(0, newOrder), input.id, ...without.slice(newOrder)];
    for (let i = 0; i < next.length; i++) {
      const id = next[i];
      const m = all.find((x) => x.id === id);
      if (m && m.sortOrder !== (i + 1) * 10) {
        m.sortOrder = (i + 1) * 10;
        await this.repo.save(m);
      }
    }
  }

  async initPresets(): Promise<{ removed: number; added: number; keptCustom: number }> {
    const before = await this.repo.find();
    const toRemove = before.filter((m) => m.isPreset === 1);
    if (toRemove.length > 0) {
      await this.repo.delete({ id: In(toRemove.map((m) => m.id)) });
    }
    await this.onModuleInit();
    const after = await this.repo.find();
    const keptCustom = after.filter((m) => m.isPreset === 0).length;
    const added = after.filter((m) => m.isPreset === 1).length;
    return { removed: toRemove.length, added, keptCustom };
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
    if (m.apiKeyEnc === PLACEHOLDER_ENCRYPTED)
      throw new BadRequestException('请先配置 API Key');

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
        apiStyle: m.apiStyle,
      });
      const latencyMs = Date.now() - start;
      m.lastTestedAt = new Date();
      m.lastTestStatus = 'success';
      await this.repo.save(m);
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
      return { ok: false, message: '连接失败', latencyMs, error: msg };
    }
  }

  async fetchModels(baseUrl: string, apiKey: string): Promise<{ models: string[]; count: number }> {
    if (!baseUrl) throw new BadRequestException('请填写 Base URL');
    if (!apiKey) throw new BadRequestException('请填写 API Key 用于拉取');
    const models = await this.llmService.listModels(baseUrl, apiKey);
    return { models, count: models.length };
  }

  private applyIsEnabledByKey(
    entity: LlmModelEntity,
    dto: any,
    existing: boolean,
  ): void {
    // 自动推断 isEnabled：
    // 1) dto 显式传 isEnabled → 强制
    // 2) 没传 isEnabled，但传了真实 apiKey → 启用
    // 3) 没传 isEnabled，也没 apiKey（保持原样或默认）
    if (dto.isEnabled !== undefined) {
      entity.isEnabled = dto.isEnabled ? 1 : 0;
      return;
    }
    if (dto.apiKey !== undefined && dto.apiKey && dto.apiKey !== '********') {
      // 显式传了真实 Key → 启用
      entity.isEnabled = 1;
    } else if (!existing) {
      // 新建且没传 Key → 默认禁用
      entity.isEnabled = 0;
    }
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
    if (typeof dto.sortOrder === 'number') entity.sortOrder = dto.sortOrder;
    if (dto.vision !== undefined || dto.reasoning !== undefined || dto.webSearch !== undefined) {
      const base =
        (entity.capabilities as any) || inferCapabilities(entity.model, entity.provider, entity.apiStyle);
      entity.capabilities = {
        vision: dto.vision !== undefined ? !!dto.vision : base.vision === true,
        reasoning: dto.reasoning !== undefined ? !!dto.reasoning : base.reasoning === true,
        webSearch: dto.webSearch !== undefined ? !!dto.webSearch : base.webSearch === true,
      } as any;
    } else if (!entity.capabilities) {
      entity.capabilities = inferCapabilities(
        entity.model,
        entity.provider,
        entity.apiStyle,
      ) as any;
    }
  }

  private computeEffectiveState(m: LlmModelEntity): EffectiveState {
    const hasKey = m.apiKeyEnc && m.apiKeyEnc !== PLACEHOLDER_ENCRYPTED;
    if (m.isEnabled === 1 && hasKey) return 'enabled';
    if (m.isEnabled === 0 && hasKey) return 'disabled';
    if (m.isEnabled === 0 && !hasKey) return 'disabled_pending_key';
    return 'enabled_force'; // enabled=1 && !hasKey 异常态
  }

  serialize(m: LlmModelEntity): any {
    const hasKey = m.apiKeyEnc && m.apiKeyEnc !== PLACEHOLDER_ENCRYPTED;
    return {
      id: m.id,
      provider: m.provider,
      model: m.model,
      displayName: m.displayName,
      baseUrl: m.baseUrl,
      apiVersion: m.apiVersion,
      maxTokens: m.maxTokens,
      isPreset: m.isPreset === 1,
      isEnabled: m.isEnabled === 1,
      effectiveState: this.computeEffectiveState(m),
      apiKeyConfigured: hasKey,
      apiKeyMasked: this.maskApiKey(m.apiKeyEnc),
      lastTestedAt: m.lastTestedAt,
      lastTestStatus: m.lastTestStatus,
      capabilities: m.capabilities ?? {
        vision: false,
        reasoning: false,
        webSearch: false,
      },
      toolSupported: m.toolSupported ?? null,
      sortOrder: m.sortOrder ?? 0,
      apiStyle: m.apiStyle,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  private maskApiKey(enc: string | null): string {
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
