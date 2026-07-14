import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum KnowledgeBaseStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  READY = 'ready',
  DISABLED = 'disabled',
}

@Entity('knowledge_bases')
export class KnowledgeBaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 128 })
  name: string;

  @Column({ length: 512, nullable: true })
  description: string | null;

  @Column({ length: 64, nullable: true })
  domain: string | null;

  @Column({ type: 'json', nullable: true })
  tags: string[] | null;

  @Column({ name: 'file_count', type: 'int', default: 0 })
  fileCount: number;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount: number;

  @Column({ name: 'total_chars', type: 'bigint', default: 0 })
  totalChars: number;

  @Column({ name: 'ai_score', type: 'float', nullable: true })
  aiScore: number | null;

  @Column({ name: 'ai_summary', length: 512, nullable: true })
  aiSummary: string | null;

  @Column({
    type: 'enum',
    enum: KnowledgeBaseStatus,
    default: KnowledgeBaseStatus.DRAFT,
  })
  status: KnowledgeBaseStatus;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum KnowledgeFileStatus {
  PENDING = 'pending',
  PARSING = 'parsing',
  PARSED = 'parsed',
  EMBEDDING = 'embedding',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('knowledge_base_files')
export class KnowledgeBaseFileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'kb_id', type: 'bigint' })
  kbId: number;

  @Column({ length: 255 })
  filename: string;

  @Column({ name: 'file_type', length: 16 })
  fileType: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'storage_path', length: 512 })
  storagePath: string;

  @Column({ name: 'parsed_text', type: 'longtext', nullable: true })
  parsedText: string | null;

  @Column({ name: 'parsed_summary', type: 'text', nullable: true })
  parsedSummary: string | null;

  @Column({ name: 'parsed_topics', type: 'json', nullable: true })
  parsedTopics: string[] | null;

  @Column({ name: 'qa_pairs', type: 'json', nullable: true })
  qaPairs: any[] | null;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount: number;

  @Column({ name: 'total_chars', type: 'int', default: 0 })
  totalChars: number;

  @Column({ name: 'ai_score', type: 'float', nullable: true })
  aiScore: number | null;

  @Column({
    type: 'enum',
    enum: KnowledgeFileStatus,
    default: KnowledgeFileStatus.PENDING,
  })
  status: KnowledgeFileStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'uploaded_by', type: 'bigint', nullable: true })
  uploadedBy: number | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @Column({ name: 'parsed_at', type: 'datetime', nullable: true })
  parsedAt: Date | null;
}

@Entity('knowledge_base_chunks')
export class KnowledgeBaseChunkEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'kb_id', type: 'bigint' })
  kbId: number;

  @Column({ name: 'file_id', type: 'bigint' })
  fileId: number;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ type: 'mediumtext' })
  content: string;

  @Column({ name: 'char_count', type: 'int' })
  charCount: number;

  @Column({ name: 'embedding_b64', type: 'mediumtext' })
  embeddingB64: string;

  @Column({ name: 'qa_pairs', type: 'json', nullable: true })
  qaPairs: any[] | null;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('agent_knowledge_bindings')
export class AgentKnowledgeBindingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'agent_id', type: 'bigint' })
  agentId: number;

  @Column({ name: 'kb_id', type: 'bigint' })
  kbId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
