import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentTemplateEntity } from '../../database/entities';
import { AgentsService } from './agents.service';

const FALLBACK_TEMPLATES: Array<{
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string;
  suggestedModel: string | null;
  icon: string;
  category: 'pr' | 'service' | 'writing' | 'analysis' | 'other';
}> = [
  {
    name: '舆情危机公关助手',
    description: '处理品牌危机事件，提供公关应对方案',
    systemPrompt: `你是一位资深的品牌危机公关专家。你的任务是：
1. 分析负面舆情事件的严重程度和潜在影响
2. 制定分级应对策略（冷处理/声明/道歉/法律行动）
3. 起草对外声明、媒体沟通稿、内部通报
4. 提供舆情降温的具体执行步骤
5. 跟踪舆情走势并调整应对方案

请始终保持专业、冷静、客观的态度，输出结构化、可执行的方案。`,
    capabilities: JSON.stringify({ vision: false, reasoning: true, webSearch: true }),
    suggestedModel: null,
    icon: 'shield',
    category: 'pr',
  },
  {
    name: '智能客服助手',
    description: '自动回复用户咨询，处理常见问题',
    systemPrompt: `你是一位专业的智能客服专家。你的任务是：
1. 准确理解用户问题，识别用户意图
2. 提供清晰、准确、友好的回答
3. 处理投诉时先安抚情绪，再解决问题
4. 遇到无法处理的问题，引导用户转接人工客服
5. 记录常见问题以便持续优化

请保持礼貌、耐心、专业的服务态度。`,
    capabilities: JSON.stringify({ vision: false, reasoning: false, webSearch: false }),
    suggestedModel: null,
    icon: 'headset',
    category: 'service',
  },
  {
    name: '内容创作助手',
    description: '生成舆情分析报告、新闻稿等内容',
    systemPrompt: `你是一位专业的内容创作专家，擅长舆情分析和新闻写作。你的任务是：
1. 根据舆情数据生成结构化的分析报告
2. 撰写正式新闻稿、媒体通稿
3. 制作社交媒体公告文案
4. 输出格式规范、语言精准、逻辑清晰

请根据不同的输出类型选择合适的文体和语气。`,
    capabilities: JSON.stringify({ vision: false, reasoning: true, webSearch: true }),
    suggestedModel: null,
    icon: 'edit',
    category: 'writing',
  },
  {
    name: '数据分析助手',
    description: '深度分析舆情数据，发现趋势和洞察',
    systemPrompt: `你是一位资深的数据分析师，专精于舆情数据分析。你的任务是：
1. 分析舆情数据的趋势、分布和关键指标
2. 识别异常波动并分析可能原因
3. 发现深层次的洞察和关联
4. 输出可视化建议和数据解读报告

请基于数据说话，输出有数据支撑的分析结论。`,
    capabilities: JSON.stringify({ vision: false, reasoning: true, webSearch: false }),
    suggestedModel: null,
    icon: 'chart',
    category: 'analysis',
  },
  {
    name: '竞品监测助手',
    description: '实时监测竞品动态，输出竞品分析报告',
    systemPrompt: `你是一位专业的竞品分析师。你的任务是：
1. 持续跟踪指定竞品的市场动态和品牌信息
2. 分析竞品的营销策略和公关活动
3. 对比本品牌与竞品的优劣势
4. 输出竞品周报/月报，提供应对建议

请保持客观中立，基于事实进行分析。`,
    capabilities: JSON.stringify({ vision: false, reasoning: true, webSearch: true }),
    suggestedModel: null,
    icon: 'search',
    category: 'analysis',
  },
  {
    name: '社交媒体运营助手',
    description: '生成社交媒体内容，管理多平台发布',
    systemPrompt: `你是一位专业的社交媒体运营专家。你的任务是：
1. 制定社交媒体内容日历和发布计划
2. 创作适合不同平台（微博、微信、抖音、小红书等）的内容
3. 设计互动话题和用户参与活动
4. 分析社交媒体数据，优化内容策略
5. 危机时期协助制定社交媒体的沟通策略

请根据不同平台的调性调整内容和语气。`,
    capabilities: JSON.stringify({ vision: true, reasoning: false, webSearch: true }),
    suggestedModel: null,
    icon: 'share',
    category: 'writing',
  },
];

@Injectable()
export class AgentTemplateService {
  private readonly logger = new Logger(AgentTemplateService.name);

  constructor(
    @InjectRepository(AgentTemplateEntity)
    private templateRepo: Repository<AgentTemplateEntity>,
    private agentsService: AgentsService,
  ) {}

  async ensureFallbackTemplates(): Promise<void> {
    const count = await this.templateRepo.count();
    if (count > 0) return;
    this.logger.log('Seeding fallback agent templates');
    const entities = FALLBACK_TEMPLATES.map((t, i) =>
      this.templateRepo.create({ ...t, sortOrder: i }),
    );
    await this.templateRepo.save(entities);
  }

  async listTemplates(category?: string): Promise<AgentTemplateEntity[]> {
    await this.ensureFallbackTemplates();
    const where: any = { isActive: 1 };
    if (category) where.category = category;
    return this.templateRepo.find({
      where,
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async listCategories(): Promise<string[]> {
    await this.ensureFallbackTemplates();
    const rows = await this.templateRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.category', 'category')
      .where('t.is_active = 1')
      .orderBy('t.category')
      .getRawMany();
    return rows.map((r: any) => r.category);
  }

  async getTemplate(id: number): Promise<AgentTemplateEntity> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('模板不存在');
    return t;
  }

  async createFromTemplate(
    userId: number,
    templateId: number,
    overrides?: {
      name?: string;
      primaryModelId: number;
      fallbackModelIds?: number[];
    },
  ): Promise<any> {
    const template = await this.getTemplate(templateId);
    const agent = await this.agentsService.create({
      name: overrides?.name || template.name,
      roleDescription: template.description,
      systemPrompt: template.systemPrompt,
      primaryModelId: overrides.primaryModelId,
      fallbackModelIds: overrides.fallbackModelIds || [],
      temperature: 0.7,
      maxTokens: 2048,
      capabilities: JSON.parse(template.capabilities || '{}'),
    });
    return agent;
  }

  async createTemplate(dto: {
    name: string;
    description: string;
    systemPrompt: string;
    capabilities: string;
    suggestedModel?: string;
    icon?: string;
    category: string;
    sortOrder?: number;
  }): Promise<AgentTemplateEntity> {
    const t = this.templateRepo.create({
      name: dto.name,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      capabilities: dto.capabilities,
      suggestedModel: dto.suggestedModel || null,
      icon: dto.icon || 'robot',
      category: dto.category as any,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.templateRepo.save(t);
  }

  async updateTemplate(
    id: number,
    dto: Partial<{
      name: string;
      description: string;
      systemPrompt: string;
      capabilities: string;
      suggestedModel: string;
      icon: string;
      category: string;
      sortOrder: number;
    }>,
  ): Promise<AgentTemplateEntity> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('模板不存在');
    if (dto.name !== undefined) t.name = dto.name;
    if (dto.description !== undefined) t.description = dto.description;
    if (dto.systemPrompt !== undefined) t.systemPrompt = dto.systemPrompt;
    if (dto.capabilities !== undefined) t.capabilities = dto.capabilities;
    if (dto.suggestedModel !== undefined) t.suggestedModel = dto.suggestedModel;
    if (dto.icon !== undefined) t.icon = dto.icon;
    if (dto.category !== undefined) t.category = dto.category as any;
    if (dto.sortOrder !== undefined) t.sortOrder = dto.sortOrder;
    return this.templateRepo.save(t);
  }

  async deleteTemplate(id: number): Promise<void> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('模板不存在');
    await this.templateRepo.remove(t);
  }

  async toggleTemplate(id: number): Promise<AgentTemplateEntity> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('模板不存在');
    t.isActive = t.isActive ? 0 : 1;
    return this.templateRepo.save(t);
  }
}
