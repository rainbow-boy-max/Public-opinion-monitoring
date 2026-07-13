import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmModelEntity } from '../../database/entities';
import { CryptoUtil } from '../../utils/crypto.util';
import { LlmService } from './llm.service';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface LlmRequestInput {
  primaryModelId: number;
  fallbackModelIds: number[];
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmCallAttempt {
  modelId: number;
  modelLabel: string;
  success: boolean;
  error?: string;
  latencyMs: number;
  tokensUsed?: number;
}

export interface LlmCallResult {
  content: string;
  primaryAttempt: LlmCallAttempt;
  fallbackAttempts: LlmCallAttempt[];
  totalLatencyMs: number;
  modelUsed: string;
  tokensUsed: number;
}

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);

  constructor(
    @InjectRepository(LlmModelEntity)
    private repo: Repository<LlmModelEntity>,
    private llmService: LlmService,
  ) {}

  async chat(input: LlmRequestInput): Promise<LlmCallResult> {
    const orderedIds = [input.primaryModelId, ...(input.fallbackModelIds || [])];
    const uniqueIds = Array.from(new Set(orderedIds)).filter((x) => !!x);
    const totalStart = Date.now();

    let primaryAttempt: LlmCallAttempt = {
      modelId: input.primaryModelId,
      modelLabel: `model#${input.primaryModelId}`,
      success: false,
      error: 'not_attempted',
      latencyMs: 0,
    };
    const fallbackAttempts: LlmCallAttempt[] = [];

    let lastError: any = null;

    for (let i = 0; i < uniqueIds.length; i++) {
      const modelId = uniqueIds[i];
      const model = await this.repo.findOne({ where: { id: modelId } });
      if (!model) continue;
      if (model.isEnabled !== 1) {
        const msg = '模型已禁用';
        if (i === 0) {
          primaryAttempt = { ...primaryAttempt, error: msg, success: false };
        } else {
          fallbackAttempts.push({
            modelId,
            modelLabel: this.modelLabel(model),
            success: false,
            error: msg,
            latencyMs: 0,
          });
        }
        continue;
      }

      const apiKey = CryptoUtil.decrypt(model.apiKeyEnc);
      if (apiKey === '__PLACEHOLDER_NEED_USER_INPUT__' || !apiKey) {
        const msg = 'API Key 未配置';
        if (i === 0) {
          primaryAttempt = { ...primaryAttempt, error: msg, success: false };
        } else {
          fallbackAttempts.push({
            modelId,
            modelLabel: this.modelLabel(model),
            success: false,
            error: msg,
            latencyMs: 0,
          });
        }
        continue;
      }

      const start = Date.now();
      try {
        const resp = await this.llmService.chat({
          model: model.model,
          baseUrl: model.baseUrl,
          apiKey,
          messages: input.messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        });

        const latencyMs = Date.now() - start;
        const successAttempt: LlmCallAttempt = {
          modelId,
          modelLabel: this.modelLabel(model),
          success: true,
          latencyMs,
          tokensUsed: resp.totalTokens,
        };
        if (i === 0) {
          primaryAttempt = successAttempt;
        } else {
          fallbackAttempts.push(successAttempt);
        }

        return {
          content: resp.content,
          primaryAttempt,
          fallbackAttempts,
          totalLatencyMs: Date.now() - totalStart,
          modelUsed: `${model.provider}/${model.model}`,
          tokensUsed: resp.totalTokens,
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        lastError = err;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const failedAttempt: LlmCallAttempt = {
          modelId,
          modelLabel: this.modelLabel(model),
          success: false,
          error: errorMsg,
          latencyMs,
        };
        if (i === 0) {
          primaryAttempt = failedAttempt;
        } else {
          fallbackAttempts.push(failedAttempt);
        }
        this.logger.warn(
          `Model ${model.provider}/${model.model} failed: ${errorMsg} — try fallback`,
        );
      }
    }

    const lastErrMsg =
      lastError instanceof Error ? lastError.message : '所有模型调用失败';
    throw new BadRequestException(`所有 LLM 模型均失败: ${lastErrMsg}`);
  }

  async *streamChat(input: LlmRequestInput): AsyncGenerator<
    { chunk?: string; finalResult?: LlmCallResult },
    void,
    unknown
  > {
    const orderedIds = [input.primaryModelId, ...(input.fallbackModelIds || [])];
    const uniqueIds = Array.from(new Set(orderedIds)).filter((x) => !!x);
    const totalStart = Date.now();
    let primaryAttempt: LlmCallAttempt = {
      modelId: input.primaryModelId,
      modelLabel: `model#${input.primaryModelId}`,
      success: false,
      error: 'not_attempted',
      latencyMs: 0,
    };
    const fallbackAttempts: LlmCallAttempt[] = [];

    for (let i = 0; i < uniqueIds.length; i++) {
      const modelId = uniqueIds[i];
      const model = await this.repo.findOne({ where: { id: modelId } });
      if (!model) continue;
      if (model.isEnabled !== 1) continue;
      const apiKey = CryptoUtil.decrypt(model.apiKeyEnc);
      if (apiKey === '__PLACEHOLDER_NEED_USER_INPUT__' || !apiKey) continue;

      const start = Date.now();
      try {
        const stream = this.llmService.streamChat({
          model: model.model,
          baseUrl: model.baseUrl,
          apiKey,
          messages: input.messages,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
        });
        const finalContent: string[] = [];
        let totalTokens = 0;

        for await (const delta of stream) {
          finalContent.push(delta);
          yield { chunk: delta };
        }
        const content = finalContent.join('');
        const latencyMs = Date.now() - start;
        const success: LlmCallAttempt = {
          modelId,
          modelLabel: this.modelLabel(model),
          success: true,
          latencyMs,
          tokensUsed: content.length,
        };
        if (i === 0) primaryAttempt = success;
        else fallbackAttempts.push(success);

        const finalResult: LlmCallResult = {
          content,
          primaryAttempt,
          fallbackAttempts,
          totalLatencyMs: Date.now() - totalStart,
          modelUsed: `${model.provider}/${model.model}`,
          tokensUsed: totalTokens,
        };
        yield { finalResult };
        return;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const failed: LlmCallAttempt = {
          modelId,
          modelLabel: this.modelLabel(model),
          success: false,
          error: errorMsg,
          latencyMs: Date.now() - start,
        };
        if (i === 0) primaryAttempt = failed;
        else fallbackAttempts.push(failed);
        this.logger.warn(
          `Stream model ${model.provider}/${model.model} failed: ${errorMsg}`,
        );
      }
    }
    throw new BadRequestException('所有 LLM 模型流式调用均失败');
  }

  private modelLabel(model: LlmModelEntity): string {
    return `${model.provider}/${model.model} (${model.displayName})`;
  }
}
