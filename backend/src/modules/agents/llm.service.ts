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
  apiStyle?: 'openai' | 'anthropic';
  systemPrompt?: string;
}

export interface ChatCompletionResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  modelUsed: string;
  raw?: any;
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
    if (req.apiStyle === 'anthropic') {
      return this.callAnthropicMessages(req);
    }
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
        raw: response,
      };
    } catch (err) {
      this.handleError(err, req);
    }
  }

  async *streamChat(
    req: ChatCompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    if (req.apiStyle === 'anthropic') {
      yield* this.streamAnthropicMessages(req);
      return;
    }
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

  // ---------- Anthropic Messages API ----------

  private splitSystemFromMessages(messages: ChatMessage[]): {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  } {
    let system: string | undefined;
    const rest: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        system = system ? system + '\n\n' + m.content : m.content;
        continue;
      }
      rest.push({ role: m.role, content: m.content });
    }
    return { system, messages: rest };
  }

  private buildAnthropicUrl(baseUrl: string): string {
    return baseUrl.replace(/\/$/, '') + '/v1/messages';
  }

  private async callAnthropicMessages(
    req: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const { system, messages } = this.splitSystemFromMessages(req.messages);
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      messages,
    };
    if (system) body.system = system;
    if (req.systemPrompt) body.system = req.systemPrompt;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 90_000);
    try {
      const resp = await fetch(this.buildAnthropicUrl(req.baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': req.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        this.handleError(
          new Error(`Anthropic ${resp.status} ${resp.statusText}: ${txt.slice(0, 200)}`),
          req,
        );
      }
      const json: any = await resp.json();
      const blocks = Array.isArray(json?.content) ? json.content : [];
      const text = blocks
        .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
        .join('');
      const usage = json?.usage || {};
      return {
        content: text,
        promptTokens: usage.input_tokens || 0,
        completionTokens: usage.output_tokens || 0,
        totalTokens:
          (usage.input_tokens || 0) + (usage.output_tokens || 0),
        modelUsed: json?.model || req.model,
        raw: json,
      };
    } catch (err) {
      this.handleError(err, req);
    } finally {
      clearTimeout(t);
    }
  }

  private async *streamAnthropicMessages(
    req: ChatCompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    const { system, messages } = this.splitSystemFromMessages(req.messages);
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
      messages,
      stream: true,
    };
    if (system) body.system = system;
    if (req.systemPrompt) body.system = req.systemPrompt;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 90_000);
    let resp: Response | null = null;
    try {
      resp = await fetch(this.buildAnthropicUrl(req.baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': req.apiKey,
          'anthropic-version': '2023-06-01',
          accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        const txt = resp ? await resp.text().catch(() => '') : '';
        this.handleError(
          new Error(`Anthropic ${resp?.status} ${resp?.statusText}: ${txt.slice(0, 200)}`),
          req,
        );
      }
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const ev = this.parseAnthropicSseFrame(frame);
          if (ev.event === 'content_block_delta' && ev.data?.delta?.type === 'text_delta') {
            yield ev.data.delta.text as string;
          }
        }
      }
    } catch (err) {
      this.handleError(err, req);
    } finally {
      clearTimeout(t);
    }
  }

  private parseAnthropicSseFrame(raw: string): {
    event: string;
    data: any;
  } {
    let event = '';
    let data = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event += line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    try {
      return { event, data: data ? JSON.parse(data) : null };
    } catch {
      return { event, data: null };
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
