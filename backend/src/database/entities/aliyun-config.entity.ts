import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('aliyun_configs')
export class AliyunConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'config_type', length: 32 })
  configType: string;

  @Column({
    name: 'endpoint_type',
    type: 'varchar', length: 32,
    enum: ['common', 'beijing', 'shanghai'],
    default: 'common',
  })
  endpointType: 'common' | 'beijing' | 'shanghai';

  @Column({
    name: 'param_type',
    type: 'varchar', length: 32,
    enum: ['normal', 'md5', 'sm2'],
    default: 'md5',
  })
  paramType: 'normal' | 'md5' | 'sm2';

  @Column({ name: 'region', length: 64, nullable: true })
  region: string | null;

  @Column({ name: 'access_key', type: 'text' })
  accessKey: string;

  @Column({ name: 'secret_key', type: 'text' })
  secretKey: string;

  @Column({ name: 'sign_name', length: 64, nullable: true })
  signName: string | null;

  @Column({ name: 'template_code', length: 64, nullable: true })
  templateCode: string | null;

  @Column({ name: 'product_code', length: 64, nullable: true })
  productCode: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
