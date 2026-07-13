import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  baseUrl: string;
  apiKey: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  modelUsed: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private configService: ConfigService) {}

  private buildClient(baseUrl: string, apiKey: string): OpenAI {
    return new OpenAI({
      baseURL: baseUrl,
      apiKey,
      timeout: 90 * 1000,
      maxRetries: 0,
    });
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const client = this.buildClient(req.baseUrl, req.apiKey);
    try {
      const response = await client.chat.completions.create({
        model: req.model,
        messages: req.messages as any,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2048,
        stream: false,
      });

      const choice = response.choices?.[0];
      const content = choice?.message?.content || '';
      return {
        content: typeof content === 'string' ? content : '',
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        modelUsed: response.model || req.model,
      };
    } catch (err) {
      this.handleError(err, req);
    }
  }

  async *streamChat(
    req: ChatCompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    const client = this.buildClient(req.baseUrl, req.apiKey);
    let stream;
    try {
      stream = await client.chat.completions.create({
        model: req.model,
        messages: req.messages as any,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2048,
        stream: true,
      });
    } catch (err) {
      this.handleError(err, req);
    }

    for await (const chunk of stream as any) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta as string;
    }
  }

  async listModels(baseUrl: string, apiKey: string): Promise<string[]> {
    const client = this.buildClient(baseUrl, apiKey);
    try {
      const res = await client.models.list();
      const ids: string[] = [];
      for await (const m of res as any) {
        if (m?.id && typeof m.id === 'string') ids.push(m.id);
      }
      return ids;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`获取模型列表失败: ${msg}`);
    }
  }

  private handleError(err: unknown, req: ChatCompletionRequest): never {
    if (err instanceof APIError) {
      const status = err.status;
      const msg = err.message;
      if (status === 401) {
        throw new BadRequestException(`API Key 无效 (${req.model}): ${msg}`);
      }
      if (status === 404) {
        throw new BadRequestException(`模型 ${req.model} 不存在或无权访问: ${msg}`);
      }
      if (status === 429) {
        throw new BadRequestException(`请求频率超限 (${req.model}): ${msg}`);
      }
      throw new BadRequestException(`LLM 调用失败 (${req.model} ${status}): ${msg}`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(`LLM error [${req.model}]: ${msg}`);
    throw new BadRequestException(`LLM 调用异常: ${msg}`);
  }
}
