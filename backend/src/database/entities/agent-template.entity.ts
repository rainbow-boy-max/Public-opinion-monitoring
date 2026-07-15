import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('agent_templates')
export class AgentTemplateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 256 })
  description: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ name: 'capabilities', type: 'text' })
  capabilities: string;

  @Column({ name: 'suggested_model', length: 64, nullable: true })
  suggestedModel: string | null;

  @Column({ name: 'icon', length: 64, default: 'robot' })
  icon: string;

  @Column({ name: 'category', length: 32 })
  category: 'pr' | 'service' | 'writing' | 'analysis' | 'other';

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'tinyint', default: 1 })
  isActive: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
