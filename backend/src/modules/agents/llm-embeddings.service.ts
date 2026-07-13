import { Injectable, Logger } from '@nestjs/common';

export interface EmbeddingResult {
  vector: number[];
  model: string;
}

@Injectable()
export class LlmEmbeddingsService {
  private readonly logger = new Logger(LlmEmbeddingsService.name);
  private readonly EMBEDDING_DIM = 384;

  /**
   * 简易 hash-based 向量化（轻量级）
   * 在不引入额外依赖的前提下提供稳定的语义相似度计算能力。
   * 生产环境推荐替换为真实 Embedding 模型 (bge-small-zh、text-embedding-3-small 等)。
   */
  embed(text: string): EmbeddingResult {
    const clean = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const vec = new Array(this.EMBEDDING_DIM).fill(0);

    if (!clean) return { vector: vec, model: 'hash-384' };

    const tokens = clean.split(/[\s,.;:!?()\[\]{}"'<>/\\|，。；：！？（）【】、]/).filter((t) => t.length > 0);

    const weights = new Map<string, number>();
    for (const tk of tokens) {
      weights.set(tk, (weights.get(tk) || 0) + 1);
    }
    let totalWeight = 0;
    for (const [, w] of weights) totalWeight += w;
    if (totalWeight === 0) return { vector: vec, model: 'hash-384' };

    const trigrams = this.trigrams(clean);
    for (let pos = 0; pos < trigrams.length; pos++) {
      const tri = trigrams[pos];
      const slot = this.hash(tri);
      const sign = this.sign(tri);
      vec[slot] += sign / Math.sqrt(totalWeight);
    }

    const bigrams = this.bigrams(clean);
    for (let pos = 0; pos < bigrams.length; pos++) {
      const bi = bigrams[pos];
      const slot = this.hash(bi + pos.toString(16));
      const sign = this.sign(bi);
      vec[slot] += (sign * 0.5) / Math.sqrt(totalWeight);
    }

    return this.normalize({ vector: vec, model: 'hash-384' });
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private normalize(result: EmbeddingResult): EmbeddingResult {
    const norm = Math.sqrt(result.vector.reduce((s, v) => s + v * v, 0));
    if (norm > 0) for (let i = 0; i < result.vector.length; i++) result.vector[i] /= norm;
    return result;
  }

  private trigrams(s: string): string[] {
    const out: string[] = [];
    for (let i = 0; i <= s.length - 3; i++) out.push(s.substring(i, i + 3));
    return out;
  }

  private bigrams(s: string): string[] {
    const out: string[] = [];
    for (let i = 0; i <= s.length - 2; i++) out.push(s.substring(i, i + 2));
    return out;
  }

  private hash(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h) % this.EMBEDDING_DIM;
  }

  private sign(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
    return h & 1 ? 1 : -1;
  }
}
