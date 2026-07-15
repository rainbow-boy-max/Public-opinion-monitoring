import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import {
  OpinionEventEntity,
  MonitorTaskEntity,
} from '../../database/entities';

interface GraphNode {
  id: number;
  title: string;
  platform: string;
  author: string;
  publishTime: string;
  sentiment: string;
  readCount: number;
}

interface GraphLink {
  source: number;
  target: number;
  relationType: string;
  similarity: number;
}

export interface PropagationGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GetGraphOptions {
  hours?: number;
  limit?: number;
}

@Injectable()
export class PropagationService {
  private readonly logger = new Logger(PropagationService.name);

  constructor(
    @InjectRepository(OpinionEventEntity)
    private eventRepo: Repository<OpinionEventEntity>,
    @InjectRepository(MonitorTaskEntity)
    private taskRepo: Repository<MonitorTaskEntity>,
  ) {}

  async getPropagationGraph(
    userId: number,
    taskId: number,
    options?: GetGraphOptions,
  ): Promise<PropagationGraph> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('Task not found or access denied');

    const hours = options?.hours ?? 24;
    const limit = options?.limit ?? 50;
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const events = await this.eventRepo.find({
      where: {
        taskId,
        publishTime: MoreThanOrEqual(since),
        status: 0,
      },
      order: { publishTime: 'ASC' },
      take: limit,
    });

    if (events.length === 0) {
      return { nodes: [], links: [] };
    }

    const nodes: GraphNode[] = events.map((e) => ({
      id: e.id,
      title: e.title,
      platform: e.platform,
      author: e.author,
      publishTime: e.publishTime.toISOString(),
      sentiment: e.sentiment,
      readCount: e.readCount,
    }));

    const links: GraphLink[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];
        const similarity = this.computeSimilarity(a.title, b.title);
        if (similarity >= 0.3) {
          const key = `${a.id}-${b.id}`;
          if (processed.has(key)) continue;
          processed.add(key);

          const aTime = a.publishTime.getTime();
          const bTime = b.publishTime.getTime();
          const source = aTime <= bTime ? a : b;
          const target = aTime <= bTime ? b : a;

          links.push({
            source: source.id,
            target: target.id,
            relationType: a.platform !== b.platform ? 'repost' : 'similar',
            similarity: Math.round(similarity * 100) / 100,
          });
        }
      }
    }

    return { nodes, links };
  }

  private computeSimilarity(titleA: string, titleB: string): number {
    const tokenize = (t: string): Set<string> => {
      const cleaned = t.replace(/[^\w\u4e00-\u9fff]/g, ' ');
      const parts = cleaned.split(/\s+/).filter(Boolean);
      const chars: string[] = [];
      for (const part of parts) {
        if (/[\u4e00-\u9fff]/.test(part)) {
          for (const ch of part) chars.push(ch);
        } else {
          chars.push(part.toLowerCase());
        }
      }
      return new Set(chars);
    };

    const setA = tokenize(titleA);
    const setB = tokenize(titleB);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  private readonly demoNodes: GraphNode[] = [
    { id: 1, title: '某知名品牌产品出现质量问题引发关注', platform: 'weibo', author: '热门话题君', publishTime: new Date(Date.now() - 48 * 3600000).toISOString(), sentiment: 'negative', readCount: 850000 },
    { id: 2, title: '某品牌产品被曝质量隐患，官方尚未回应', platform: 'weixin', author: '科技早报', publishTime: new Date(Date.now() - 36 * 3600000).toISOString(), sentiment: 'negative', readCount: 320000 },
    { id: 3, title: '紧急提醒：某品牌产品存在严重质量问题', platform: 'douyin', author: '消费预警', publishTime: new Date(Date.now() - 30 * 3600000).toISOString(), sentiment: 'negative', readCount: 1200000 },
    { id: 4, title: '某品牌质量问题持续发酵，消费者集体维权', platform: 'kuaishou', author: '社会热点', publishTime: new Date(Date.now() - 24 * 3600000).toISOString(), sentiment: 'negative', readCount: 560000 },
    { id: 5, title: '某品牌官方回应质量质疑：正在调查中', platform: 'xiaohongshu', author: '品牌观察', publishTime: new Date(Date.now() - 18 * 3600000).toISOString(), sentiment: 'neutral', readCount: 280000 },
    { id: 6, title: '深度分析：某品牌质量危机背后的供应链问题', platform: 'baijiahao', author: '财经深观察', publishTime: new Date(Date.now() - 12 * 3600000).toISOString(), sentiment: 'neutral', readCount: 150000 },
    { id: 7, title: '某品牌宣布召回问题产品，股价应声下跌', platform: 'weibo', author: '财经快讯', publishTime: new Date(Date.now() - 6 * 3600000).toISOString(), sentiment: 'negative', readCount: 920000 },
  ];

  private readonly demoLinks: GraphLink[] = [
    { source: 1, target: 2, relationType: 'repost', similarity: 0.72 },
    { source: 1, target: 3, relationType: 'repost', similarity: 0.65 },
    { source: 2, target: 4, relationType: 'repost', similarity: 0.68 },
    { source: 3, target: 5, relationType: 'quote', similarity: 0.55 },
    { source: 4, target: 6, relationType: 'quote', similarity: 0.48 },
    { source: 5, target: 7, relationType: 'repost', similarity: 0.61 },
    { source: 1, target: 7, relationType: 'similar', similarity: 0.35 },
  ];

  getDemoGraph(): PropagationGraph {
    return { nodes: this.demoNodes, links: this.demoLinks };
  }
}
