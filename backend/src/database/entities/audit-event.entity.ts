import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AuditActorType = 'admin' | 'user' | 'system';

@Entity('audit_events')
@Index('idx_audit_module_time', ['module', 'createdAt'])
@Index('idx_audit_resource', ['resourceType', 'resourceId'])
export class AuditEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'actor_id', type: 'bigint', nullable: true })
  actorId: number | null;

  @Column({
    name: 'actor_type',
    type: 'varchar', length: 32,
    enum: ['admin', 'user', 'system'],
    default: 'admin',
  })
  actorType: AuditActorType;

  @Column({ length: 32 })
  module: string;

  @Column({ length: 32 })
  action: string;

  @Column({ name: 'resource_type', length: 32, nullable: true })
  resourceType: string | null;

  @Column({ name: 'resource_id', type: 'bigint', nullable: true })
  resourceId: number | null;

  @Column({ length: 128 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
