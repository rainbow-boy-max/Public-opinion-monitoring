import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OpinionEventEntity } from './opinion-event.entity';

export interface TriggerEvent {
  eventId: number;
  title: string;
  time: Date;
  impact: number;
}

export interface KeyNode {
  type: 'kol' | 'media' | 'official';
  name: string;
  followersCount: number;
  propagationPower: number;
}

export interface PropagationEdge {
  source: string;
  target: string;
  weight: number;
}

@Entity('attribution_analyses')
export class AttributionAnalysisEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Column({ name: 'trigger_events', type: 'json', comment: '触发事件列表' })
  triggerEvents: TriggerEvent[];

  @Column({ name: 'key_nodes', type: 'json', comment: '关键传播节点' })
  keyNodes: KeyNode[];

  @Column({ name: 'propagation_path', type: 'json', comment: '传播路径' })
  propagationPath: PropagationEdge[];

  @Column({ name: 'analysis_content', type: 'longtext', comment: '归因分析内容' })
  analysisContent: string;

  @Column({ name: 'llm_generated', type: 'boolean', default: true, comment: '是否由LLM生成' })
  llmGenerated: boolean;

  @Column({ name: 'analysis_duration_ms', type: 'int', nullable: true, comment: '分析耗时（毫秒）' })
  analysisDurationMs: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
