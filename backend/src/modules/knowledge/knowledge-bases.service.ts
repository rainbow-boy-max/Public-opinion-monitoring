import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { Queue } from 'bull';
import {
  KnowledgeBaseEntity,
  KnowledgeBaseStatus,
  KnowledgeBaseFileEntity,
  KnowledgeFileStatus,
  KnowledgeBaseChunkEntity,
  AgentKnowledgeBindingEntity,
  AgentEntity,
} from '../../database/entities';
import { LlmEmbeddingsService } from '../agents/llm-embeddings.service';
import { LlmService } from '../agents/llm.service';
import { LlmRouterService } from '../agents/llm-router.service';
import { ChatMessage } from '../agents/llm.service';

const ALLOWED_EXTS = ['pdf', 'docx', 'ppt', 'pptx', 'txt', 'md', 'html'];

export interface CreateKbDto {
  name: string;
  description?: string;
  domain?: string;
  tags?: string[];
}

export interface UpdateKbDto {
  name?: string;
  description?: string;
  domain?: string;
  tags?: string[];
  status?: string;
}

import { KbScoringService } from './kb-scoring.service';

@Injectable()
export class KnowledgeBasesService {
  private readonly logger = new Logger(KnowledgeBasesService.name);

  constructor(
    @InjectRepository(KnowledgeBaseEntity)
    private kbRepo: Repository<KnowledgeBaseEntity>,
    @InjectRepository(KnowledgeBaseFileEntity)
    private fileRepo: Repository<KnowledgeBaseFileEntity>,
    @InjectRepository(KnowledgeBaseChunkEntity)
    private chunkRepo: Repository<KnowledgeBaseChunkEntity>,
    @InjectRepository(AgentKnowledgeBindingEntity)
    private bindingRepo: Repository<AgentKnowledgeBindingEntity>,
    @InjectRepository(AgentEntity)
    private agentRepo: Repository<AgentEntity>,
    @InjectQueue('knowledge-parse') private parseQueue: Queue,
    private embeddingsService: LlmEmbeddingsService,
    private llmService: LlmService,
    private llmRouterService: LlmRouterService,
    private readonly kbScoringService: KbScoringService,
  ) {}

  async list(params: { page: number; pageSize: number; status?: string; q?: string }): Promise<any> {
    const { page, pageSize, status, q } = params;
    const qb = this.kbRepo.createQueryBuilder('kb');
    if (status) qb.andWhere('kb.status = :status', { status });
    if (q) qb.andWhere('(kb.name LIKE :q OR kb.description LIKE :q)', { q: `%${q}%` });
    qb.orderBy('kb.id', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((k) => ({
        ...k,
        tags: k.tags || [],
      })),
      total,
      page,
      pageSize,
    };
  }

  async getOne(id: number): Promise<KnowledgeBaseEntity> {
    const k = await this.kbRepo.findOne({ where: { id } });
    if (!k) throw new NotFoundException('知识库不存在');
    return k;
  }

  async create(dto: CreateKbDto, operatorId: number): Promise<KnowledgeBaseEntity> {
    if (!dto.name?.trim()) throw new BadRequestException('知识库名称必填');
    const k = this.kbRepo.create({
      name: dto.name.trim(),
      description: dto.description || null,
      domain: dto.domain || null,
      tags: dto.tags || [],
      status: KnowledgeBaseStatus.DRAFT,
      fileCount: 0,
      chunkCount: 0,
      totalChars: 0,
      createdBy: operatorId,
    });
    return this.kbRepo.save(k);
  }

  async update(id: number, dto: UpdateKbDto): Promise<KnowledgeBaseEntity> {
    const k = await this.getOne(id);
    if (dto.name !== undefined) k.name = dto.name;
    if (dto.description !== undefined) k.description = dto.description;
    if (dto.domain !== undefined) k.domain = dto.domain;
    if (dto.tags !== undefined) k.tags = dto.tags;
    if (dto.status !== undefined) k.status = dto.status as any;
    return this.kbRepo.save(k);
  }

  async delete(id: number): Promise<void> {
    const k = await this.getOne(id);
    const files = await this.fileRepo.find({ where: { kbId: id } });
    for (const f of files) {
      try {
        const fs = await import('fs/promises');
        await fs.unlink(f.storagePath);
      } catch { /* ignore */ }
    }
    await this.chunkRepo.delete({ kbId: id });
    await this.fileRepo.delete({ kbId: id });
    await this.bindingRepo.delete({ kbId: id });
    await this.kbRepo.remove(k);
  }

  async listFiles(kbId: number): Promise<KnowledgeBaseFileEntity[]> {
    await this.getOne(kbId);
    return this.fileRepo.find({ where: { kbId }, order: { id: 'DESC' } });
  }

  async deleteFile(kbId: number, fileId: number): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, kbId } });
    if (!file) throw new NotFoundException('文件不存在');
    try {
      const fs = await import('fs/promises');
      await fs.unlink(file.storagePath);
    } catch { /* ignore */ }
    await this.chunkRepo.delete({ fileId });
    await this.fileRepo.remove(file);
    await this.refreshKbStats(kbId);
  }

  async getFileContent(kbId: number, fileId: number): Promise<{ content: string }> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, kbId } });
    if (!file) throw new NotFoundException('文件不存在');
    if (file.parsedText) {
      return { content: file.parsedText };
    }
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(file.storagePath, 'utf-8');
      return { content: content.slice(0, 50000) };
    } catch {
      return { content: '// 无法读取文件内容' };
    }
  }

  async updateFileContent(kbId: number, fileId: number, content: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, kbId } });
    if (!file) throw new NotFoundException('文件不存在');
    file.parsedText = content;
    await this.fileRepo.save(file);
    // 更新 chunks
    await this.chunkRepo.delete({ fileId });
    if (content.trim()) {
      const chunks = this.splitText(content, 1000, 200);
      const chunkEntities = chunks.map((t, i) =>
        this.chunkRepo.create({
          fileId,
          kbId,
          chunkIndex: i,
          content: t,
          charCount: t.length,
        }),
      );
      await this.chunkRepo.save(chunkEntities);
    }
    await this.refreshKbStats(kbId);
  }

  async enqueueParse(kbId: number, fileId: number, filePath: string, fileType: string): Promise<void> {
    await this.parseQueue.add(
      'parse',
      { kbId, fileId, filePath, fileType },
      { attempts: 2, removeOnComplete: 50, removeOnFail: 50 },
    );
  }

  async parseAndStore(
    kbId: number,
    fileId: number,
    filePath: string,
    fileType: string,
  ): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) return;
    try {
      file.status = KnowledgeFileStatus.PARSING as any;
      await this.fileRepo.save(file);

      const fs = await import('fs/promises');
      const buf = await fs.readFile(filePath);
      const text = await this.extractText(buf, fileType, filePath);

      if (!text || text.trim().length === 0) {
        throw new Error('文档内容为空或无法解析');
      }

      file.parsedText = text;
      file.totalChars = text.length;
      file.status = KnowledgeFileStatus.PARSED as any;
      file.parsedAt = new Date();
      await this.fileRepo.save(file);

      await this.chunkRepo.delete({ fileId });

      const chunks = this.splitText(text, 800, 100);
      const chunkEntities = chunks.map((chunk, index) => {
        const embedded = this.embeddingsService.embed(chunk);
        return {
          kbId,
          fileId,
          chunkIndex: index,
          content: chunk,
          charCount: chunk.length,
          embeddingB64: Buffer.from(JSON.stringify(embedded.vector)).toString('base64'),
          qaPairs: null as any,
          metadata: JSON.stringify({ source: file.filename, fileType }),
        };
      });

      if (chunkEntities.length > 0) {
        await this.chunkRepo.save(chunkEntities);
      }

      file.chunkCount = chunkEntities.length;
      file.status = KnowledgeFileStatus.EMBEDDING;
      await this.fileRepo.save(file);

      // AI 打分：让 LLM 对这个文档相关性/质量进行评分
      let aiScore: number | null = null;
      let aiSummary: string | null = null;
      let topics: string[] = [];
      let qaPairs: any[] = [];
      try {
        const aiResult = await this.scoreFileWithAI(file, text);
        aiScore = aiResult.score;
        aiSummary = aiResult.summary;
        topics = aiResult.topics;
        qaPairs = aiResult.qaPairs;
      } catch (err) {
        this.logger.warn(`AI score failed for file ${fileId}: ${(err as Error).message}`);
      }

      file.aiScore = aiScore;
      file.parsedSummary = aiSummary;
      file.parsedTopics = topics;
      file.qaPairs = qaPairs;
      file.status = KnowledgeFileStatus.READY;
      file.parsedAt = new Date();
      await this.fileRepo.save(file);

      // 同步 chunk 的 qaPairs 到第一条
      if (qaPairs.length > 0 && chunkEntities.length > 0) {
        await this.chunkRepo.update(
          { fileId, chunkIndex: 0 },
          { qaPairs: JSON.stringify(qaPairs) as any },
        );
      }

      await this.refreshKbStats(kbId);
      this.logger.log(
        `KB file parsed: ${file.filename} → ${chunkEntities.length} chunks, ai_score=${aiScore}`,
      );
    } catch (err) {
      file.status = KnowledgeFileStatus.FAILED;
      file.errorMessage = (err as Error).message.substring(0, 500);
      await this.fileRepo.save(file);
      this.logger.error(`KB parse failed [${file.filename}]: ${(err as Error).message}`);
    }
  }

  async retrieve(
    kbId: number,
    query: string,
    topK = 4,
  ): Promise<Array<{ content: string; score: number; source: string }>> {
    if (!query || query.trim().length === 0) return [];
    const chunks = await this.chunkRepo.find({ where: { kbId }, take: 1000 });
    if (chunks.length === 0) return [];

    const queryVec = this.embeddingsService.embed(query).vector;

    const scored = chunks.map((ch) => {
      let vec: number[] = [];
      try {
        vec = JSON.parse(Buffer.from(ch.embeddingB64, 'base64').toString('utf8'));
      } catch {
        vec = [];
      }
      const score = vec.length > 0 ? this.embeddingsService.cosineSimilarity(queryVec, vec) : 0;
      let meta: any = {};
      try {
        meta = JSON.parse((ch as any).metadata || '{}');
      } catch { /* ignore */ }
      return { content: ch.content, score, source: meta.source || 'unknown' };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((s) => s.score > 0.05);
  }

  async multiKbRetrieve(
    kbIds: number[],
    query: string,
    topKPerKb = 3,
  ): Promise<Array<{ content: string; score: number; source: string; kbId: number }>> {
    const all: Array<{ content: string; score: number; source: string; kbId: number }> = [];
    for (const kbId of kbIds) {
      const hits = await this.retrieve(kbId, query, topKPerKb);
      for (const h of hits) all.push({ ...h, kbId });
    }
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, topKPerKb * kbIds.length);
  }

  async searchAcrossAllKbs(query: string, topK = 10): Promise<any[]> {
    if (!query || !query.trim()) return [];
    const kbs = await this.kbRepo.find({
      where: { status: KnowledgeBaseStatus.READY },
      select: ['id', 'name'],
    });
    if (kbs.length === 0) return [];
    const results = await this.multiKbRetrieve(kbs.map((k) => k.id), query, 2);
    const kbsById = new Map(kbs.map((k) => [k.id, k.name]));
    return results.slice(0, topK).map((r) => ({
      ...r,
      kbName: kbsById.get(r.kbId) || '?',
    }));
  }

  async bindAgent(agentId: number, kbIds: number[]): Promise<void> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('智能体不存在');
    await this.bindingRepo.delete({ agentId });
    if (kbIds.length > 0) {
      const list = kbIds.map((kbId) => this.bindingRepo.create({ agentId, kbId }));
      await this.bindingRepo.save(list);
    }
  }

  async getAgentKbIds(agentId: number): Promise<number[]> {
    const bindings = await this.bindingRepo.find({ where: { agentId } });
    return bindings.map((b) => b.kbId);
  }

  async listAvailableKbs(): Promise<any[]> {
    const kbs = await this.kbRepo.find({
      where: { status: KnowledgeBaseStatus.READY },
      order: { id: 'DESC' },
    });
    return kbs.map((k) => ({
      id: Number(k.id),
      name: k.name,
      description: k.description,
      fileCount: k.fileCount,
      aiScore: k.aiScore,
    }));
  }

  async refreshKbStats(kbId: number): Promise<void> {
    const files = await this.fileRepo.find({ where: { kbId } });
    const readyFiles = files.filter((f) => f.status === KnowledgeFileStatus.READY);
    let totalChunks = 0;
    let totalChars = 0;
    for (const f of files) {
      await this.fileRepo.update(f.id, {
        chunkCount: f.chunkCount || 0,
        totalChars: f.totalChars || 0,
      });
      totalChunks += f.chunkCount || 0;
      totalChars += f.totalChars || 0;
    }
    const kb = await this.getOne(kbId);
    kb.fileCount = readyFiles.length;
    kb.chunkCount = totalChunks;
    kb.totalChars = totalChars;
    if (readyFiles.length > 0 && kb.status === KnowledgeBaseStatus.PROCESSING) {
      kb.status = KnowledgeBaseStatus.READY;
    } else if (readyFiles.length > 0 && kb.status === KnowledgeBaseStatus.DRAFT) {
      kb.status = KnowledgeBaseStatus.READY;
    }
    await this.kbRepo.save(kb);
  }

  async aiAutoClassify(kbId: number): Promise<void> {
    const kb = await this.getOne(kbId);
    if (!kb.chunkCount || kb.chunkCount === 0) return;
    const samples = await this.chunkRepo.find({
      where: { kbId },
      take: 5,
      order: { id: 'ASC' },
    });
    const combinedText = samples.map((s) => s.content).join('\n\n---\n\n');
    const prompt = `请对以下知识库内容进行分析，返回 JSON 格式包含：domain(行业领域英文，如 technology/finance/medical/legal/education/general)、tags(3-5 个关键词数组)、summary(100-200 字摘要)。\n\n知识库内容：\n${combinedText.substring(0, 2000)}`;
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: '你是内容分析专家，总是返回严格 JSON。',
        },
        { role: 'user', content: prompt },
      ];
      const result = await this.llmRouterService.chat({
        primaryModelId: 0,
        fallbackModelIds: [],
        messages,
        temperature: 0.3,
        maxTokens: 500,
      });

      const json = this.tryParseJson(result.content);
      if (json) {
        if (typeof json.domain === 'string') kb.domain = json.domain;
        if (Array.isArray(json.tags)) kb.tags = json.tags.slice(0, 10);
        if (typeof json.summary === 'string') kb.aiSummary = json.summary.substring(0, 512);
        await this.kbRepo.save(kb);
      }
    } catch (err) {
      this.logger.warn(`AI auto-classify failed: ${(err as Error).message}`);
    }
  }

  private tryParseJson(content: string): any | null {
    try {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) return null;
      return JSON.parse(content.substring(jsonStart, jsonEnd + 1));
    } catch {
      return null;
    }
  }

  private async scoreFileWithAI(
    file: KnowledgeBaseFileEntity,
    text: string,
  ): Promise<{ score: number; summary: string; topics: string[]; qaPairs: any[] }> {
    try {
      const kb = await this.getOne(file.kbId);
      const result = await this.kbScoringService.scoreDocument({
        filename: file.filename,
        fileContent: text,
        kbName: kb.name,
        kbDomain: kb.domain || 'general',
        kbTags: kb.tags || [],
        filePath: file.storagePath,
      });
      return {
        score: result.score,
        summary: result.summary,
        topics: result.topics,
        qaPairs: result.qaPairs,
      };
    } catch (err) {
      this.logger.warn(`Score AI error: ${(err as Error).message}`);
    }
    return { score: 0, summary: '', topics: [], qaPairs: [] };
  }

  private splitText(text: string, chunkSize: number, overlap: number): string[] {
    const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    const chunks: string[] = [];
    let i = 0;
    while (i < clean.length) {
      const end = Math.min(i + chunkSize, clean.length);
      let slice = clean.substring(i, end);
      if (end < clean.length) {
        const lastPeriod = slice.lastIndexOf('。');
        const lastExclam = slice.lastIndexOf('！');
        const lastQuestion = slice.lastIndexOf('？');
        const lastNewline = slice.lastIndexOf('\n');
        const lastCut = Math.max(lastPeriod, lastExclam, lastQuestion, lastNewline);
        if (lastCut > chunkSize * 0.6) slice = slice.substring(0, lastCut + 1);
      }
      const trimmed = slice.trim();
      if (trimmed) chunks.push(trimmed);
      const nextStart = i + slice.length - overlap;
      i = nextStart > i ? nextStart : i + 1;
    }
    return chunks;
  }

  private async extractText(buf: Buffer, fileType: string, filePath: string): Promise<string> {
    const ft = fileType.toLowerCase();
    if (ft === 'pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buf);
        return data.text || '';
      } catch (err) {
        this.logger.warn(`pdf-parse failed: ${(err as Error).message}`);
        return buf.toString('utf-8');
      }
    }
    if (ft === 'docx' || filePath.toLowerCase().endsWith('.docx')) {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: buf });
        return result.value || '';
      } catch (err) {
        this.logger.warn(`mammoth failed: ${(err as Error).message}`);
        return buf.toString('utf-8');
      }
    }
    if (
      ft === 'pptx' ||
      ft === 'ppt' ||
      filePath.toLowerCase().endsWith('.pptx') ||
      filePath.toLowerCase().endsWith('.ppt')
    ) {
      const text = buf.toString('utf-8');
      const matches = text.match(/[\u4e00-\u9fffA-Za-z0-9\.\,，。！？、\s]+/g);
      return matches ? matches.join(' ').replace(/\s+/g, ' ').trim() : '';
    }
    return buf.toString('utf-8');
  }
}
