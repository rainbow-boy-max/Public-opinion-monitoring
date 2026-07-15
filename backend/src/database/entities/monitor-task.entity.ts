import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum MatchMode {
  EXACT = 'exact',
  FUZZY = 'fuzzy',
  BOTH = 'both',
}

export enum SentimentFilter {
  ALL = 'all',
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
}

export enum TaskFrequency {
  FIVE_MIN = '5min',
  FIFTEEN_MIN = '15min',
  THIRTY_MIN = '30min',
  SIXTY_MIN = '60min',
}

export enum TaskStatus {
  ENABLED = 'enabled',
  PAUSED = 'paused',
  ERROR = 'error',
}

@Entity('monitor_tasks')
export class MonitorTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'tenant_id', nullable: true })
  tenantId: number | null;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ length: 128 })
  name: string;

  @Column({ type: 'text' })
  keywords: string;

  @Column({ name: 'exclude_keywords', type: 'json', nullable: true })
  excludeKeywords: string | null;

  @Column({ type: 'json' })
  platforms: string[];

  @Column({
    name: 'match_mode',
    type: 'varchar', length: 32,
    enum: MatchMode,
    default: MatchMode.BOTH,
  })
  matchMode: MatchMode;

  @Column({
    name: 'sentiment_filter',
    type: 'varchar', length: 32,
    enum: SentimentFilter,
    default: SentimentFilter.ALL,
  })
  sentimentFilter: SentimentFilter;

  @Column({ name: 'min_read_threshold', type: 'int', default: 0 })
  minReadThreshold: number;

  @Column({ name: 'min_like_threshold', type: 'int', default: 0 })
  minLikeThreshold: number;

  @Column({
    type: 'varchar', length: 32,
    enum: TaskFrequency,
    default: TaskFrequency.FIFTEEN_MIN,
  })
  frequency: TaskFrequency;

  @Column({
    type: 'varchar', length: 32,
    enum: TaskStatus,
    default: TaskStatus.ENABLED,
  })
  status: TaskStatus;

  @Column({ name: 'last_run_at', type: 'datetime', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}