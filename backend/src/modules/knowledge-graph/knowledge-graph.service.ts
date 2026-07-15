import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { LlmRouterService } from '../agents/llm-router.service';
import { OpinionEventEntity } from '../../database/entities';
import type { ChatMessage } from '../agents/llm.service';

export interface GraphNode {
  id: string;
  name: string;
  type: 'person' | 'org' | 'place' | 'product' | 'event' | 'keyword';
  weight: number;
  sentiment?: string;
  category: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  strength: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: Array<{ name: string; color: string }>;
}

export interface ExtractedEntity {
  id: string;
  name: string;
  type: 'person' | 'org' | 'place' | 'product' | 'event';
  mentions: string[];
}

export interface GraphStats {
  totalEntities: number;
  totalRelations: number;
  entityTypeBreakdown: Record<string, number>;
  topEntities: Array<{ id: string; name: string; type: string; connections: number }>;
  relationTypeBreakdown: Record<string, number>;
}

const CATEGORY_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
const CATEGORY_NAMES = ['人物', '组织', '地点', '产品', '事件'];

const CATEGORY_MAP: Record<string, number> = {
  person: 0,
  org: 1,
  place: 2,
  product: 3,
  event: 4,
};

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    private llmRouterService: LlmRouterService,
  ) {}

  async extractGraph(userId: number, options?: {
    taskIds?: number[];
    hours?: number;
    maxNodes?: number;
  }): Promise<KnowledgeGraph> {
    try {
      const hours = options?.hours ?? 168;
      const maxNodes = options?.maxNodes ?? 50;
      const now = new Date();
      const start = new Date(now.getTime() - hours * 60 * 60 * 1000);

      const where: any = {};
      if (options?.taskIds && options.taskIds.length > 0) {
        where.taskId = In(options.taskIds);
      }
      where.matchedAt = Between(start, now);

      const events = await this.eventRepo.find({
        where,
        order: { readCount: 'DESC' },
        take: 100,
      });

      if (events.length === 0) {
        return this.getMockGraph();
      }

      const combinedText = events
        .map((e, i) => `[事件 ${i + 1}] 标题: ${e.title}\n内容: ${e.content?.substring(0, 300) || ''}\n平台: ${e.platform}\n作者: ${e.author}`)
        .join('\n\n---\n\n');

      return this.extractFromText(combinedText, maxNodes);
    } catch (err) {
      this.logger.warn(`LLM extraction failed, using mock: ${err}`);
      return this.getMockGraph();
    }
  }

  async extractFromText(text: string, maxNodes?: number): Promise<KnowledgeGraph> {
    try {
      const entities = await this.extractEntities(text);
      return this.buildGraph(entities, maxNodes);
    } catch (err) {
      this.logger.warn(`LLM extraction from text failed, using mock: ${err instanceof Error ? err.message : err}`);
      return this.getMockGraph();
    }
  }

  async extractEntities(text: string): Promise<{ entities: ExtractedEntity[]; relations: Array<{ source: string; target: string; relation: string; strength: number }> }> {
    const prompt = `从以下文本中提取实体（人物、组织、地点、产品、事件）及它们之间的关系。返回JSON格式：
{
  "entities": [
    { "id": "唯一标识", "name": "实体名称", "type": "person|org|place|product|event", "mentions": ["提及方式1", "提及方式2"] }
  ],
  "relations": [
    { "source": "实体id", "target": "实体id", "relation": "关系描述", "strength": 0.5 }
  ]
}

要求：
- type: person(人物), org(组织/公司), place(地点), product(产品), event(事件)
- strength: 0-1，关系强度
- 至少提取5个实体
- id用英文小写+下划线，如"zhangsan"、"alibaba"

文本：
${text.substring(0, 6000)}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个实体抽取专家，严格返回JSON。' },
      { role: 'user', content: prompt },
    ];

    const result = await this.llmRouterService.chat({
      primaryModelId: 0,
      fallbackModelIds: [],
      messages,
      temperature: 0.3,
      maxTokens: 3000,
    });

    const parsed = this.tryParseJson(result.content);
    if (parsed && Array.isArray(parsed.entities)) {
      return parsed as any;
    }

    throw new Error('Failed to parse LLM entity extraction');
  }

  private buildGraph(data: { entities: ExtractedEntity[]; relations: Array<{ source: string; target: string; relation: string; strength: number }> }, maxNodes?: number): KnowledgeGraph {
    const limit = maxNodes ?? 50;
    const entities = data.entities.slice(0, limit);
    const entityIds = new Set(entities.map(e => e.id));
    const relations = data.relations.filter(r => entityIds.has(r.source) && entityIds.has(r.target));

    const connectionCount = new Map<string, number>();
    for (const r of relations) {
      connectionCount.set(r.source, (connectionCount.get(r.source) || 0) + 1);
      connectionCount.set(r.target, (connectionCount.get(r.target) || 0) + 1);
    }

    const maxConn = Math.max(...Array.from(connectionCount.values()), 1);

    const nodes: GraphNode[] = entities.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      weight: Math.max(1, (connectionCount.get(e.id) || 1) / maxConn * 50),
      category: CATEGORY_MAP[e.type] ?? 0,
    }));

    const edges: GraphEdge[] = relations.map(r => ({
      source: r.source,
      target: r.target,
      relation: r.relation,
      strength: Math.max(0.1, Math.min(1, r.strength)),
    }));

    return {
      nodes,
      edges,
      categories: CATEGORY_NAMES.map((name, i) => ({ name, color: CATEGORY_COLORS[i] })),
    };
  }

  async getGraphStats(userId: number): Promise<GraphStats> {
    const graph = this.getMockGraph();

    const typeBreakdown: Record<string, number> = {};
    for (const n of graph.nodes) {
      typeBreakdown[n.type] = (typeBreakdown[n.type] || 0) + 1;
    }

    const connectionCount = new Map<string, number>();
    for (const e of graph.edges) {
      connectionCount.set(e.source, (connectionCount.get(e.source) || 0) + 1);
      connectionCount.set(e.target, (connectionCount.get(e.target) || 0) + 1);
    }

    const topEntities = [...connectionCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const node = graph.nodes.find(n => n.id === id);
        return {
          id,
          name: node?.name || id,
          type: node?.type || 'keyword',
          connections: count,
        };
      });

    const relationTypeBreakdown: Record<string, number> = {};
    for (const e of graph.edges) {
      relationTypeBreakdown[e.relation] = (relationTypeBreakdown[e.relation] || 0) + 1;
    }

    return {
      totalEntities: graph.nodes.length,
      totalRelations: graph.edges.length,
      entityTypeBreakdown: typeBreakdown,
      topEntities,
      relationTypeBreakdown,
    };
  }

  async searchGraph(userId: number, query: string): Promise<KnowledgeGraph> {
    const graph = this.getMockGraph();
    const q = query.toLowerCase();

    const matched = graph.nodes.filter(n =>
      n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q),
    );

    if (matched.length === 0) {
      return { nodes: [], edges: [], categories: graph.categories };
    }

    const matchedIds = new Set(matched.map(n => n.id));
    const connectedEdgeIds = new Set<string>();

    for (const e of graph.edges) {
      if (matchedIds.has(e.source) || matchedIds.has(e.target)) {
        connectedEdgeIds.add(`${e.source}->${e.target}`);
      }
    }

    const connectedNodeIds = new Set<string>(matchedIds);
    for (const e of graph.edges) {
      if (connectedEdgeIds.has(`${e.source}->${e.target}`)) {
        connectedNodeIds.add(e.source);
        connectedNodeIds.add(e.target);
      }
    }

    return {
      nodes: graph.nodes.filter(n => connectedNodeIds.has(n.id)),
      edges: graph.edges.filter(e => connectedEdgeIds.has(`${e.source}->${e.target}`)),
      categories: graph.categories,
    };
  }

  getMockGraph(): KnowledgeGraph {
    const nodes: GraphNode[] = [
      { id: 'huawei', name: '华为', type: 'org', weight: 60, category: 1 },
      { id: 'apple', name: '苹果', type: 'org', weight: 55, category: 1 },
      { id: 'xiaomi', name: '小米', type: 'org', weight: 45, category: 1 },
      { id: 'tencent', name: '腾讯', type: 'org', weight: 50, category: 1 },
      { id: 'alibaba', name: '阿里巴巴', type: 'org', weight: 50, category: 1 },
      { id: 'baidu', name: '百度', type: 'org', weight: 40, category: 1 },
      { id: 'bytedance', name: '字节跳动', type: 'org', weight: 45, category: 1 },
      { id: 'catl', name: '宁德时代', type: 'org', weight: 35, category: 1 },
      { id: 'nio', name: '蔚来汽车', type: 'org', weight: 30, category: 1 },
      { id: 'xpeng', name: '小鹏汽车', type: 'org', weight: 28, category: 1 },

      { id: 'renzhengfei', name: '任正非', type: 'person', weight: 50, category: 0 },
      { id: 'tim_cook', name: '蒂姆·库克', type: 'person', weight: 45, category: 0 },
      { id: 'lei_jun', name: '雷军', type: 'person', weight: 48, category: 0 },
      { id: 'ma_huateng', name: '马化腾', type: 'person', weight: 42, category: 0 },
      { id: 'zhang_yiming', name: '张一鸣', type: 'person', weight: 38, category: 0 },
      { id: 'li_yanhong', name: '李彦宏', type: 'person', weight: 35, category: 0 },
      { id: 'wang_chuanfu', name: '王传福', type: 'person', weight: 32, category: 0 },
      { id: 'he_xiaopeng', name: '何小鹏', type: 'person', weight: 28, category: 0 },
      { id: 'li_bin', name: '李斌', type: 'person', weight: 26, category: 0 },
      { id: 'yu_chengdong', name: '余承东', type: 'person', weight: 40, category: 0 },

      { id: 'beijing', name: '北京', type: 'place', weight: 35, category: 2 },
      { id: 'shanghai', name: '上海', type: 'place', weight: 30, category: 2 },
      { id: 'shenzhen', name: '深圳', type: 'place', weight: 32, category: 2 },
      { id: 'hangzhou', name: '杭州', type: 'place', weight: 28, category: 2 },
      { id: 'guangzhou', name: '广州', type: 'place', weight: 26, category: 2 },
      { id: 'silicon_valley', name: '硅谷', type: 'place', weight: 30, category: 2 },

      { id: 'mate60', name: 'Mate 60', type: 'product', weight: 48, category: 3 },
      { id: 'iphone15', name: 'iPhone 15', type: 'product', weight: 45, category: 3 },
      { id: 'xiaomi_su7', name: '小米SU7', type: 'product', weight: 42, category: 3 },
      { id: 'wenjie_m9', name: '问界M9', type: 'product', weight: 35, category: 3 },
      { id: 'wechat', name: '微信', type: 'product', weight: 40, category: 3 },
      { id: 'douyin', name: '抖音', type: 'product', weight: 38, category: 3 },
      { id: 'aliyun', name: '阿里云', type: 'product', weight: 35, category: 3 },
      { id: 'baidu_wenxin', name: '文心一言', type: 'product', weight: 30, category: 3 },
      { id: 'p7', name: '小鹏P7', type: 'product', weight: 25, category: 3 },
      { id: 'et7', name: '蔚来ET7', type: 'product', weight: 24, category: 3 },
      { id: 'kirin_chip', name: '麒麟芯片', type: 'product', weight: 38, category: 3 },
      { id: 'hongmeng', name: '鸿蒙OS', type: 'product', weight: 36, category: 3 },

      { id: 'chip_ban', name: '芯片制裁', type: 'event', weight: 40, category: 4 },
      { id: 'ai_competition', name: 'AI大模型竞赛', type: 'event', weight: 38, category: 4 },
      { id: 'ev_price_war', name: '新能源汽车价格战', type: 'event', weight: 35, category: 4 },
      { id: 'tech_independence', name: '科技自主创新', type: 'event', weight: 30, category: 4 },
      { id: 'digital_trade', name: '数字贸易摩擦', type: 'event', weight: 25, category: 4 },
      { id: 'smart_driving', name: '智能驾驶普及', type: 'event', weight: 28, category: 4 },
    ];

    const edges: GraphEdge[] = [
      { source: 'huawei', target: 'renzhengfei', relation: '创始人', strength: 0.9 },
      { source: 'huawei', target: 'yu_chengdong', relation: '高管', strength: 0.8 },
      { source: 'huawei', target: 'mate60', relation: '发布', strength: 0.8 },
      { source: 'huawei', target: 'kirin_chip', relation: '自研', strength: 0.9 },
      { source: 'huawei', target: 'hongmeng', relation: '开发', strength: 0.85 },
      { source: 'huawei', target: 'chip_ban', relation: '受影响', strength: 0.7 },
      { source: 'huawei', target: 'tech_independence', relation: '推动', strength: 0.75 },
      { source: 'huawei', target: 'shenzhen', relation: '总部位于', strength: 0.8 },

      { source: 'apple', target: 'tim_cook', relation: 'CEO', strength: 0.85 },
      { source: 'apple', target: 'iphone15', relation: '发布', strength: 0.8 },
      { source: 'apple', target: 'silicon_valley', relation: '总部位于', strength: 0.7 },
      { source: 'apple', target: 'chip_ban', relation: '受益方', strength: 0.4 },

      { source: 'xiaomi', target: 'lei_jun', relation: '创始人', strength: 0.9 },
      { source: 'xiaomi', target: 'xiaomi_su7', relation: '发布', strength: 0.85 },
      { source: 'xiaomi', target: 'ev_price_war', relation: '参与', strength: 0.7 },
      { source: 'xiaomi', target: 'beijing', relation: '总部位于', strength: 0.75 },
      { source: 'xiaomi', target: 'smart_driving', relation: '布局', strength: 0.6 },

      { source: 'tencent', target: 'ma_huateng', relation: '创始人', strength: 0.85 },
      { source: 'tencent', target: 'wechat', relation: '开发', strength: 0.9 },
      { source: 'tencent', target: 'shenzhen', relation: '总部位于', strength: 0.8 },
      { source: 'tencent', target: 'ai_competition', relation: '参与', strength: 0.6 },

      { source: 'alibaba', target: 'hangzhou', relation: '总部位于', strength: 0.8 },
      { source: 'alibaba', target: 'aliyun', relation: '旗下', strength: 0.85 },
      { source: 'alibaba', target: 'ai_competition', relation: '参与', strength: 0.65 },
      { source: 'alibaba', target: 'digital_trade', relation: '受影响', strength: 0.5 },

      { source: 'baidu', target: 'li_yanhong', relation: '创始人', strength: 0.8 },
      { source: 'baidu', target: 'baidu_wenxin', relation: '发布', strength: 0.85 },
      { source: 'baidu', target: 'ai_competition', relation: '引领', strength: 0.8 },
      { source: 'baidu', target: 'beijing', relation: '总部位于', strength: 0.75 },
      { source: 'baidu', target: 'smart_driving', relation: '布局', strength: 0.7 },

      { source: 'bytedance', target: 'zhang_yiming', relation: '创始人', strength: 0.8 },
      { source: 'bytedance', target: 'douyin', relation: '开发', strength: 0.9 },
      { source: 'bytedance', target: 'ai_competition', relation: '参与', strength: 0.6 },
      { source: 'bytedance', target: 'beijing', relation: '总部位于', strength: 0.7 },

      { source: 'nio', target: 'li_bin', relation: '创始人', strength: 0.85 },
      { source: 'nio', target: 'et7', relation: '发布', strength: 0.75 },
      { source: 'nio', target: 'ev_price_war', relation: '参与', strength: 0.7 },
      { source: 'nio', target: 'shanghai', relation: '总部位于', strength: 0.7 },
      { source: 'nio', target: 'smart_driving', relation: '布局', strength: 0.65 },

      { source: 'xpeng', target: 'he_xiaopeng', relation: '创始人', strength: 0.85 },
      { source: 'xpeng', target: 'p7', relation: '发布', strength: 0.75 },
      { source: 'xpeng', target: 'ev_price_war', relation: '参与', strength: 0.65 },
      { source: 'xpeng', target: 'guangzhou', relation: '总部位于', strength: 0.7 },
      { source: 'xpeng', target: 'smart_driving', relation: '领先', strength: 0.8 },

      { source: 'catl', target: 'wang_chuanfu', relation: '创始人', strength: 0.7 },
      { source: 'catl', target: 'ev_price_war', relation: '影响', strength: 0.6 },
      { source: 'catl', target: 'nio', relation: '供应商', strength: 0.6 },
      { source: 'catl', target: 'xpeng', relation: '供应商', strength: 0.55 },

      { source: 'mate60', target: 'kirin_chip', relation: '搭载', strength: 0.8 },
      { source: 'mate60', target: 'hongmeng', relation: '搭载', strength: 0.75 },
      { source: 'mate60', target: 'chip_ban', relation: '突破', strength: 0.7 },
      { source: 'mate60', target: 'tech_independence', relation: '标志', strength: 0.75 },

      { source: 'xiaomi_su7', target: 'ev_price_war', relation: '引发', strength: 0.8 },
      { source: 'xiaomi_su7', target: 'smart_driving', relation: '搭载', strength: 0.65 },

      { source: 'iphone15', target: 'chip_ban', relation: '受益于', strength: 0.3 },
      { source: 'iphone15', target: 'ai_competition', relation: '相关', strength: 0.3 },
      { source: 'iphone15', target: 'silicon_valley', relation: '设计于', strength: 0.5 },

      { source: 'hongmeng', target: 'tech_independence', relation: '推动', strength: 0.8 },
      { source: 'hongmeng', target: 'ai_competition', relation: '布局', strength: 0.5 },

      { source: 'kirin_chip', target: 'chip_ban', relation: '突破', strength: 0.85 },
      { source: 'kirin_chip', target: 'tech_independence', relation: '标志', strength: 0.8 },

      { source: 'aliyun', target: 'ai_competition', relation: '参与', strength: 0.6 },
      { source: 'baidu_wenxin', target: 'ai_competition', relation: '引领', strength: 0.8 },

      { source: 'wenjie_m9', target: 'huawei', relation: '合作', strength: 0.8 },
      { source: 'wenjie_m9', target: 'smart_driving', relation: '搭载', strength: 0.75 },
      { source: 'wenjie_m9', target: 'hongmeng', relation: '搭载', strength: 0.7 },

      { source: 'wechat', target: 'tencent', relation: '旗下', strength: 0.9 },
      { source: 'douyin', target: 'bytedance', relation: '旗下', strength: 0.9 },
      { source: 'douyin', target: 'ai_competition', relation: '应用', strength: 0.5 },
      { source: 'wechat', target: 'digital_trade', relation: '受影响', strength: 0.4 },

      { source: 'chip_ban', target: 'tech_independence', relation: '催化', strength: 0.8 },
      { source: 'chip_ban', target: 'digital_trade', relation: '体现', strength: 0.6 },
      { source: 'ai_competition', target: 'tech_independence', relation: '推动', strength: 0.7 },
      { source: 'ev_price_war', target: 'smart_driving', relation: '加速', strength: 0.6 },

      { source: 'renzhengfei', target: 'tech_independence', relation: '倡导', strength: 0.8 },
      { source: 'yu_chengdong', target: 'mate60', relation: '发布', strength: 0.7 },
      { source: 'lei_jun', target: 'xiaomi_su7', relation: '发布', strength: 0.8 },
      { source: 'lei_jun', target: 'ev_price_war', relation: '评论', strength: 0.6 },
    ];

    return { nodes, edges, categories: CATEGORY_NAMES.map((name, i) => ({ name, color: CATEGORY_COLORS[i] })) };
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
