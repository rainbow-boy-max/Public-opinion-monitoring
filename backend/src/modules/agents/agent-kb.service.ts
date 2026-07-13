import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as fs from 'fs/promises';
import {
  AgentEntity,
  AgentKbFileEntity,
  AgentKbChunkEntity,
  KbFileStatus,
} from '../../database/entities';
import { LlmEmbeddingsService } from './llm-embeddings.service';

@Injectable()
export class AgentKbService {
  private readonly logger = new Logger(AgentKbService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private agentRepo: Repository<AgentEntity>,
    @InjectRepository(AgentKbFileEntity)
    private fileRepo: Repository<AgentKbFileEntity>,
    @InjectRepository(AgentKbChunkEntity)
    private chunkRepo: Repository<AgentKbChunkEntity>,
    @InjectQueue('agent-kb') private kbQueue: Queue,
    private embeddingsService: LlmEmbeddingsService,
  ) {}

  async ensureAgentExists(agentId: number): Promise<AgentEntity> {
    const a = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!a) throw new NotFoundException('智能体不存在');
    return a;
  }

  async listFiles(agentId: number): Promise<any[]> {
    await this.ensureAgentExists(agentId);
    const files = await this.fileRepo.find({
      where: { agentId },
      order: { id: 'DESC' },
    });
    return files.map((f) => ({
      id: f.id,
      filename: f.filename,
      fileType: f.fileType,
      fileSize: f.fileSize,
      chunkCount: f.chunkCount,
      totalChars: f.totalChars,
      status: f.status,
      errorMessage: f.errorMessage,
      createdAt: f.createdAt,
    }));
  }

  async deleteFile(agentId: number, fileId: number): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, agentId } });
    if (!file) throw new NotFoundException('文件不存在');
    await this.fileRepo.remove(file);
    await this.chunkRepo.delete({ fileId });
    try {
      await fs.unlink(file.storagePath);
    } catch (err) {
      this.logger.warn(`删除物理文件失败: ${(err as Error).message}`);
    }
  }

  async enqueueFileParsing(
    agentId: number,
    fileId: number,
    filePath: string,
    fileType: string,
  ): Promise<void> {
    await this.kbQueue.add(
      'parse',
      { agentId, fileId, filePath, fileType },
      { attempts: 2, removeOnComplete: 50, removeOnFail: 50 },
    );
  }

  async parseAndStore(
    agentId: number,
    fileId: number,
    filePath: string,
    fileType: string,
  ): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) return;
    try {
      file.status = KbFileStatus.PARSING;
      await this.fileRepo.save(file);

      const buf = await fs.readFile(filePath);
      const text = await this.extractText(buf, fileType, filePath);

      if (!text || text.trim().length === 0) {
        throw new Error('文档内容为空或无法解析');
      }

      await this.chunkRepo.delete({ fileId });

      const chunks = this.splitText(text, 800, 100);
      const chunkEntities = chunks.map((chunk, index) => {
        const embedded = this.embeddingsService.embed(chunk);
        return {
          fileId,
          agentId,
          chunkIndex: index,
          content: chunk,
          charCount: chunk.length,
          embeddingB64: Buffer.from(JSON.stringify(embedded.vector)).toString('base64'),
          metadata: JSON.stringify({ source: file.filename }),
        };
      });

      if (chunkEntities.length > 0) {
        await this.chunkRepo.save(chunkEntities);
      }

      file.chunkCount = chunkEntities.length;
      file.totalChars = text.length;
      file.status = KbFileStatus.READY;
      file.errorMessage = null;
      await this.fileRepo.save(file);

      this.logger.log(`KB 文件解析成功: ${file.filename} → ${chunkEntities.length} chunks`);
    } catch (err) {
      file.status = KbFileStatus.FAILED;
      file.errorMessage = (err as Error).message.substring(0, 500);
      await this.fileRepo.save(file);
      this.logger.error(`KB parse failed [${file.filename}]: ${(err as Error).message}`);
    }
  }

  async retrieveRelevant(
    agentId: number,
    query: string,
    topK = 4,
  ): Promise<Array<{ content: string; score: number; source: string }>> {
    if (!query || query.trim().length === 0) return [];
    const allChunks = await this.chunkRepo.find({
      where: { agentId },
      take: 500,
    });
    if (allChunks.length === 0) return [];

    const queryVec = this.embeddingsService.embed(query).vector;

    const scored = allChunks.map((ch) => {
      let vec: number[] = [];
      try {
        vec = JSON.parse(Buffer.from(ch.embeddingB64, 'base64').toString('utf8'));
      } catch {
        vec = [];
      }
      const score =
        vec.length > 0 ? this.embeddingsService.cosineSimilarity(queryVec, vec) : 0;
      let meta: any = {};
      try {
        meta = JSON.parse(ch.metadata || '{}');
      } catch { /* ignore */ }
      return {
        content: ch.content,
        score,
        source: meta.source || 'unknown',
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((s) => s.score > 0.05);
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
        this.logger.warn(`pdf-parse 失败, 回落文本提取: ${(err as Error).message}`);
        return buf.toString('utf-8');
      }
    }
    if (ft === 'docx' || filePath.toLowerCase().endsWith('.docx')) {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: buf });
        return result.value || '';
      } catch (err) {
        this.logger.warn(`mammoth 失败: ${(err as Error).message}`);
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
      const textMatches = text.match(/[\u4e00-\u9fffA-Za-z0-9\.\,，。！？、\s]+/g);
      return textMatches ? textMatches.join(' ').replace(/\s+/g, ' ').trim() : '';
    }
    return buf.toString('utf-8');
  }
}
