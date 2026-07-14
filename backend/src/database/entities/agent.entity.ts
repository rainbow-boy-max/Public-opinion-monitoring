import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum LlmProvider {
  OPENAI = 'openai',
  DEEPSEEK = 'deepseek',
  DASHSCOPE = 'dashscope',
  ZHIPU = 'zhipu',
  MOONSHOT = 'moonshot',
  SILICONFLOW = 'siliconflow',
  CUSTOM = 'custom',
}

export enum AgentStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
}

@Entity('llm_models')
export class LlmModelEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 32 })
  provider: string;

  @Column({ length: 64 })
  model: string;

  @Column({ name: 'display_name', length: 128 })
  displayName: string;

  @Column({ name: 'base_url', length: 512 })
  baseUrl: string;

  @Column({ name: 'api_key_enc', type: 'text' })
  apiKeyEnc: string;

  @Column({ name: 'api_version', length: 16, default: '1.0' })
  apiVersion: string;

  @Column({ name: 'max_tokens', type: 'int', default: 4096 })
  maxTokens: number;

  @Column({ name: 'is_preset', type: 'tinyint', default: 0 })
  isPreset: number;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 1 })
  isEnabled: number;

  @Column({ name: 'last_tested_at', type: 'datetime', nullable: true })
  lastTestedAt: Date | null;

  @Column({ name: 'last_test_status', length: 32, nullable: true })
  lastTestStatus: string | null;

  @Column({
    name: 'capabilities',
    type: 'text',
    nullable: true,
  })
  capabilities: { vision: boolean; reasoning: boolean; webSearch: boolean } | null;

  @Column({ name: 'tool_supported', type: 'json', nullable: true })
  toolSupported: { webSearch?: boolean } | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({
    name: 'api_style',
    type: 'varchar', length: 32,
    enum: ['openai', 'anthropic'],
    default: 'openai',
  })
  apiStyle: 'openai' | 'anthropic';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('agents')
export class AgentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 128 })
  name: string;

  @Column({ name: 'role_description', length: 512 })
  roleDescription: string;

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string | null;

  @Column({ name: 'primary_model_id', type: 'bigint' })
  primaryModelId: number;

  @Column({ name: 'fallback_model_ids', type: 'json' })
  fallbackModelIds: number[];

  @Column({ name: 'temperature', type: 'float', default: 0.7 })
  temperature: number;

  @Column({ name: 'max_tokens', type: 'int', default: 2048 })
  maxTokens: number;

  @Column({ name: 'kb_enabled', type: 'tinyint', default: 1 })
  kbEnabled: number;

  @Column({ name: 'kb_top_k', type: 'int', default: 4 })
  kbTopK: number;

  @Column({
    type: 'varchar', length: 32,
    enum: AgentStatus,
    default: AgentStatus.ENABLED,
  })
  status: AgentStatus;

  @Column({ length: 128, nullable: true })
  avatar: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'capabilities', type: 'json', nullable: true })
  capabilities: { vision: boolean; reasoning: boolean; webSearch: boolean } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum KbFileStatus {
  PENDING = 'pending',
  PARSING = 'parsing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('agent_kb_files')
export class AgentKbFileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'agent_id', type: 'bigint' })
  agentId: number;

  @Column({ length: 255 })
  filename: string;

  @Column({ name: 'file_type', length: 16 })
  fileType: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'storage_path', length: 512 })
  storagePath: string;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount: number;

  @Column({ name: 'total_chars', type: 'int', default: 0 })
  totalChars: number;

  @Column({
    type: 'varchar', length: 32,
    enum: KbFileStatus,
    default: KbFileStatus.PENDING,
  })
  status: KbFileStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'uploaded_by', type: 'bigint', nullable: true })
  uploadedBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('agent_kb_chunks')
export class AgentKbChunkEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'file_id', type: 'bigint' })
  fileId: number;

  @Column({ name: 'agent_id', type: 'bigint' })
  agentId: number;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'char_count', type: 'int' })
  charCount: number;

  @Column({ name: 'embedding_b64', type: 'text' })
  embeddingB64: string;

  @Column({ length: 128, nullable: true })
  metadata: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

export enum PrReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('pr_reports')
export class PrReportEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'event_id', type: 'bigint', nullable: true })
  eventId: number | null;

  @Column({ name: 'agent_id', type: 'bigint', nullable: true })
  agentId: number | null;

  @Column({ name: 'input_snapshot', type: 'text', nullable: true })
  inputSnapshot: string | null;

  @Column({ name: 'analysis', type: 'text', nullable: true })
  analysis: string | null;

  @Column({ name: 'strategy', type: 'text', nullable: true })
  strategy: string | null;

  @Column({ name: 'model_used', length: 128, nullable: true })
  modelUsed: string | null;

  @Column({ name: 'tokens_used', type: 'int', default: 0 })
  tokensUsed: number;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs: number;

  @Column({
    type: 'varchar', length: 32,
    enum: PrReportStatus,
    default: PrReportStatus.PENDING,
  })
  status: PrReportStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum SmsTemplateScene {
  LOGIN = 'login',
  REGISTER = 'register',
  RESET_PASSWORD = 'reset_password',
  OPINION_ALERT = 'opinion_alert',
  BAN_NOTIFY = 'ban_notify',
  UNBAN_NOTIFY = 'unban_notify',
  GENERIC = 'generic',
}

export enum SmsTemplateStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISABLED = 'disabled',
}

@Entity('sms_templates')
export class SmsTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    type: 'varchar', length: 32,
    enum: SmsTemplateScene,
  })
  scene: SmsTemplateScene;

  @Column({ length: 128 })
  name: string;

  @Column({ name: 'sign_name', length: 64 })
  signName: string;

  @Column({ name: 'template_code', length: 64, nullable: true })
  templateCode: string | null;

  @Column({ name: 'template_content', type: 'text' })
  templateContent: string;

  @Column({ name: 'variables', type: 'text', nullable: true })
  variables: string[] | null;

  @Column({ name: 'is_default', type: 'tinyint', default: 0 })
  isDefault: number;

  @Column({ length: 256, nullable: true })
  remark: string | null;

  @Column({
    type: 'varchar', length: 32,
    enum: SmsTemplateStatus,
    default: SmsTemplateStatus.DRAFT,
  })
  status: SmsTemplateStatus;

  @Column({ name: 'reject_reason', length: 512, nullable: true })
  rejectReason: string | null;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum UserRoleExtended {
  ADMIN = 'admin',
  USER = 'user',
  OPERATOR = 'operator',
}

@Entity('user_deleted')
export class UserDeletedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'original_user_id', type: 'bigint' })
  originalUserId: number;

  @Column({ length: 64 })
  username: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'deleted_by', type: 'bigint' })
  deletedBy: number;

  @CreateDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
