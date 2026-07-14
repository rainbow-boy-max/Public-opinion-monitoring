import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AgentEntity,
  AgentStatus,
  PrReportEntity,
  PrReportStatus,
  OpinionEventEntity,
} from '../../database/entities';
import { AgentKbService } from './agent-kb.service';
import { LlmRouterService } from './llm-router.service';
import { AuditService } from '../admin/audit.service';
import { KnowledgeBasesService } from '../knowledge/knowledge-bases.service';
import {
  WebSearchService,
  WebSearchDisabledError,
} from '../admin/web-search.service';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

interface CreateAgentDto {
  name: string;
  roleDescription: string;
  systemPrompt?: string;
  primaryModelId: number;
  fallbackModelIds?: number[];
  temperature?: number;
  maxTokens?: number;
  kbEnabled?: number;
  kbTopK?: number;
  description?: string;
  avatar?: string;
  knowledgeBaseIds?: number[];
  capabilities?: { vision?: boolean; reasoning?: boolean; webSearch?: boolean };
}

interface AgentCapabilities {
  vision: boolean;
  reasoning: boolean;
  webSearch: boolean;
}

function normalizeCapabilities(input: any): AgentCapabilities {
  return {
    vision: input?.vision === true,
    reasoning: input?.reasoning === true,
    webSearch: input?.webSearch === true,
  };
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private agentRepo: Repository<AgentEntity>,
    @InjectRepository(PrReportEntity)
    private prRepo: Repository<PrReportEntity>,
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    private agentKbService: AgentKbService,
    private llmRouterService: LlmRouterService,
    private auditService: AuditService,
    private knowledgeBasesService: KnowledgeBasesService,
    private webSearchService: WebSearchService,
  ) {}

  async list(params: {
    page: number;
    pageSize: number;
    status?: string;
  }): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, status } = params;
    const qb = this.agentRepo.createQueryBuilder('a');
    if (status) qb.andWhere('a.status = :status', { status });
    qb.orderBy('a.id', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((a) => this.serialize(a)),
      total,
      page,
      pageSize,
    };
  }

  async getOne(id: number): Promise<any> {
    const a = await this.agentRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('智能体不存在');
    return this.serialize(a);
  }

  async create(dto: CreateAgentDto): Promise<any> {
    if (!dto.name || !dto.primaryModelId) {
      throw new BadRequestException('名称与主用模型必填');
    }
    const kbEnabled = dto.kbEnabled ?? 1;
    const kbIds = Array.isArray(dto.knowledgeBaseIds) ? dto.knowledgeBaseIds : [];
    if (kbEnabled === 1 && kbIds.length < 1) {
      throw new BadRequestException('KB_VALIDATION_FAILED');
    }
    const a = this.agentRepo.create({
      name: dto.name,
      roleDescription: dto.roleDescription || '',
      systemPrompt: dto.systemPrompt || null,
      primaryModelId: dto.primaryModelId,
      fallbackModelIds: dto.fallbackModelIds || [],
      temperature: dto.temperature ?? 0.7,
      maxTokens: dto.maxTokens ?? 2048,
      kbEnabled,
      kbTopK: dto.kbTopK ?? 4,
      status: AgentStatus.ENABLED,
      avatar: dto.avatar || null,
      description: dto.description || null,
      capabilities: dto.capabilities
        ? (normalizeCapabilities(dto.capabilities) as any)
        : (null as any),
    });
    const saved = await this.agentRepo.save(a);
    if (kbEnabled === 1 && kbIds.length > 0) {
      await this.knowledgeBasesService.bindAgent(saved.id, kbIds.map(Number));
    }
    await this.auditService.record({
      actorType: 'admin',
      module: 'agents',
      action: 'create',
      resourceType: 'agent',
      resourceId: saved.id,
      title: `创建智能体：${saved.name}`,
      content: `管理员创建了智能体 ${saved.name}`,
    });
    return this.serialize(saved);
  }

  async update(id: number, dto: any): Promise<any> {
    const a = await this.agentRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('智能体不存在');
    if (dto.name !== undefined) a.name = dto.name;
    if (dto.roleDescription !== undefined) a.roleDescription = dto.roleDescription;
    if (dto.systemPrompt !== undefined) a.systemPrompt = dto.systemPrompt;
    if (dto.primaryModelId !== undefined) a.primaryModelId = dto.primaryModelId;
    if (dto.fallbackModelIds !== undefined) a.fallbackModelIds = dto.fallbackModelIds;
    if (dto.temperature !== undefined) a.temperature = dto.temperature;
    if (dto.maxTokens !== undefined) a.maxTokens = dto.maxTokens;
    const nextKbEnabled = dto.kbEnabled !== undefined ? dto.kbEnabled : a.kbEnabled;
    if (dto.kbEnabled !== undefined) a.kbEnabled = dto.kbEnabled;
    if (dto.kbTopK !== undefined) a.kbTopK = dto.kbTopK;
    if (dto.status !== undefined) {
      a.status = dto.status === 'disabled' ? AgentStatus.DISABLED : AgentStatus.ENABLED;
    }
    if (dto.avatar !== undefined) a.avatar = dto.avatar;
    if (dto.description !== undefined) a.description = dto.description;
    if (dto.capabilities !== undefined) {
      a.capabilities = normalizeCapabilities(dto.capabilities) as any;
    }
    if (dto.knowledgeBaseIds !== undefined) {
      const kbIds = Array.isArray(dto.knowledgeBaseIds)
        ? dto.knowledgeBaseIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        : [];
      if (nextKbEnabled === 1 && kbIds.length < 1) {
        throw new BadRequestException('KB_VALIDATION_FAILED');
      }
      await this.agentRepo.save(a);
      if (nextKbEnabled === 1) {
        await this.knowledgeBasesService.bindAgent(a.id, kbIds);
      } else {
        await this.knowledgeBasesService.bindAgent(a.id, []);
      }
    } else {
      await this.agentRepo.save(a);
    }
    await this.auditService.record({
      actorType: 'admin',
      module: 'agents',
      action: 'update',
      resourceType: 'agent',
      resourceId: a.id,
      title: `更新智能体：${a.name}`,
    });
    return this.serialize(a);
  }

  async remove(id: number): Promise<void> {
    const a = await this.agentRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('智能体不存在');
    await this.agentRepo.remove(a);
    await this.auditService.record({
      actorType: 'admin',
      module: 'agents',
      action: 'delete',
      resourceType: 'agent',
      resourceId: id,
      title: `删除智能体：${a.name}`,
    });
  }

async chat(
    agentId: number,
    userMessage: string,
    useStream = false,
  ): Promise<any> {
    const agent = await this.getOne(agentId);
    const messages: ChatMessage[] = [];
    const capabilityLines: string[] = [];
    if ((agent.capabilities as any)?.vision) {
      capabilityLines.push('vision=true：当前智能体已开启图片理解能力。');
    }
    if ((agent.capabilities as any)?.reasoning) {
      capabilityLines.push('reasoning=true：当前智能体已开启推理与思考能力。');
    }
    if ((agent.capabilities as any)?.webSearch) {
      capabilityLines.push(
        'webSearch=true：当前智能体已开启联网搜索能力；当需要最新信息时请主动调用搜索结果。',
      );
    }
    if (agent.systemPrompt) {
      messages.push({ role: 'system', content: agent.systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    let warnings: string[] | undefined;

    let webResults: Awaited<ReturnType<WebSearchService['search']>> | null = null;
    if ((agent.capabilities as any)?.webSearch) {
      try {
        webResults = await this.webSearchService.search(userMessage);
        if (webResults.length > 0) {
          const webBlock = webResults
            .map(
              (r, i) =>
                `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`,
            )
            .join('\n\n');
          messages.unshift({
            role: 'system',
            content: `[Web Search Results]\n${webBlock}`,
          });
        }
      } catch (err) {
        if (err instanceof WebSearchDisabledError) {
          warnings = ['WEB_SEARCH_DISABLED'];
        } else {
          this.logger.warn(`web search failed: ${(err as Error).message}`);
          warnings = ['WEB_SEARCH_FAILED'];
        }
      }
    }

    if (capabilityLines.length > 0) {
      messages.unshift({
        role: 'system',
        content: `[Capabilities]\n${capabilityLines.join('\n')}`,
      });
    }

    if (agent.kbEnabled === 1) {
      const hits = await this.agentKbService.retrieveRelevant(
        agentId,
        userMessage,
        agent.kbTopK || 4,
      );
      if (hits.length > 0) {
        const kbContext = hits
          .map((h: any, i) => `[#${i + 1}] 来源: ${h.source}\n${h.content}`)
          .join('\n\n');
        const kbMessages: ChatMessage[] = [
          {
            role: 'system',
            content: `${agent.systemPrompt || ''}\n\n知识库参考:\n${kbContext}`,
          },
          { role: 'user', content: userMessage },
        ];
        const result = await this.callWithMessages(agent, kbMessages, useStream);
        return this.attachWarnings(result, warnings);
      }
    }

    const result = await this.callWithMessages(agent, messages, useStream);
    return this.attachWarnings(result, warnings);
  }

  private attachWarnings(result: any, warnings?: string[]): any {
    if (!warnings || warnings.length === 0) return result;
    if (result && typeof result === 'object') {
      return { ...result, warnings: [...warnings] };
    }
    return { content: result, warnings: [...warnings] };
  }

  private async callWithMessages(
    agent: any,
    messages: ChatMessage[],
    useStream: boolean,
  ): Promise<any> {
    if (useStream) {
      return this.llmRouterService.streamChat({
        primaryModelId: agent.primaryModelId,
        fallbackModelIds: agent.fallbackModelIds || [],
        messages,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      });
    }
    return this.llmRouterService.chat({
      primaryModelId: agent.primaryModelId,
      fallbackModelIds: agent.fallbackModelIds || [],
      messages,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });
  }

  async listAvailable(): Promise<any[]> {
    const list = await this.agentRepo.find({
      where: { status: AgentStatus.ENABLED },
      order: { id: 'DESC' },
    });
    return list.map((a) => ({
      id: a.id,
      name: a.name,
      roleDescription: a.roleDescription,
      description: a.description,
      avatar: a.avatar,
      kbEnabled: a.kbEnabled,
    }));
  }

  serialize(a: AgentEntity): any {
    return {
      id: a.id,
      name: a.name,
      roleDescription: a.roleDescription,
      systemPrompt: a.systemPrompt,
      primaryModelId: a.primaryModelId,
      fallbackModelIds: a.fallbackModelIds || [],
      temperature: a.temperature,
      maxTokens: a.maxTokens,
      kbEnabled: a.kbEnabled,
      kbTopK: a.kbTopK,
      status: a.status,
      avatar: a.avatar,
      description: a.description,
      capabilities: a.capabilities ?? { vision: false, reasoning: false, webSearch: false },
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
