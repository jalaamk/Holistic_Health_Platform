/**
 * OpenAI Provider Adapter
 * Implements AIProvider interface using OpenAI SDK
 * Phase 0: Fast shipping with OpenAI, but behind abstraction
 */

import OpenAI from 'openai';
import type { 
  AIProvider, 
  AICompletionRequest, 
  AICompletionResponse, 
  ModelInfo 
} from './interfaces';
import { getEnv } from '@/packages/config/env';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private models: Map<string, ModelInfo>;

  constructor() {
    const env = getEnv();
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    // Model registry
    this.models = new Map([
      ['gpt-4o', {
        name: 'gpt-4o',
        provider: 'openai',
        contextWindow: 128000,
        costPer1kTokens: { input: 0.0025, output: 0.01 },
      }],
      ['gpt-4o-mini', {
        name: 'gpt-4o-mini',
        provider: 'openai',
        contextWindow: 128000,
        costPer1kTokens: { input: 0.00015, output: 0.0006 },
      }],
      ['gpt-4-turbo', {
        name: 'gpt-4-turbo',
        provider: 'openai',
        contextWindow: 128000,
        costPer1kTokens: { input: 0.01, output: 0.03 },
      }],
      ['gpt-3.5-turbo', {
        name: 'gpt-3.5-turbo',
        provider: 'openai',
        contextWindow: 16385,
        costPer1kTokens: { input: 0.0005, output: 0.0015 },
      }],
    ]);
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    try {
      const startTime = Date.now();
      
      const response = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      });

      const choice = response.choices[0];
      const usage = response.usage;
      
      if (!choice || !usage) {
        throw new Error('Invalid OpenAI response');
      }

      const modelInfo = this.getModelInfo(request.model);
      const costEstimate = this.calculateCost(
        usage.prompt_tokens,
        usage.completion_tokens,
        modelInfo
      );

      const latencyMs = Date.now() - startTime;

      // Log telemetry (structured logging)
      console.log(JSON.stringify({
        event: 'ai.completion',
        promptId: request.promptId,
        promptVersion: request.promptVersion,
        model: request.model,
        userId: request.userId,
        tenantId: request.tenantId,
        tokensIn: usage.prompt_tokens,
        tokensOut: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        costEstimate,
        latencyMs,
        finishReason: choice.finish_reason,
      }));

      return {
        content: choice.message.content || '',
        model: request.model,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        costEstimate,
        finishReason: choice.finish_reason || 'unknown',
      };
    } catch (error) {
      throw new Error(`AI completion failed: ${error}`);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  getModelInfo(model: string): ModelInfo {
    const info = this.models.get(model);
    
    if (!info) {
      throw new Error(`Unknown model: ${model}`);
    }
    
    return info;
  }

  private calculateCost(
    promptTokens: number,
    completionTokens: number,
    modelInfo: ModelInfo
  ): number {
    const inputCost = (promptTokens / 1000) * modelInfo.costPer1kTokens.input;
    const outputCost = (completionTokens / 1000) * modelInfo.costPer1kTokens.output;
    return inputCost + outputCost;
  }
}

// Singleton instance
let aiProvider: OpenAIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!aiProvider) {
    aiProvider = new OpenAIProvider();
  }
  return aiProvider;
}
