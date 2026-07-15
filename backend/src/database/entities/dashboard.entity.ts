import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('custom_dashboards')
export class CustomDashboardEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ length: 128 })
  name: string;

  @Column({ type: 'text' })
  layout: string;

  @Column({ type: 'text' })
  widgets: string;

  @Column({ name: 'is_default', type: 'tinyint', default: 0 })
  isDefault: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
