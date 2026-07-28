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

export type InstructionStatus = 'pending' | 'processing' | 'completed';

@Entity('leader_instructions')
export class LeaderInstructionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'event_id', type: 'bigint' })
  eventId: number;

  @ManyToOne(() => OpinionEventEntity)
  @JoinColumn({ name: 'event_id' })
  event: OpinionEventEntity;

  @Column({ name: 'leader_name', type: 'varchar', length: 100 })
  leaderName: string;

  @Column({ type: 'text' })
  instruction: string;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: InstructionStatus;

  @Column({ name: 'handler_name', type: 'varchar', length: 100, nullable: true })
  handlerName: string | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @Column({ type: 'date', nullable: true })
  deadline: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'created_by', type: 'bigint' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
