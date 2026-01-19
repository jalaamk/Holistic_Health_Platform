import { getOpenAIProvider } from '../providers/openai-provider';
import type { AIProvider, AICompletionRequest, AICompletionResponse } from '../providers/interfaces';

// Provider configuration
export interface ProviderConfig {
  id: string;
  type: 'openai' | 'azure' | 'bedrock' | 'vertex';
  enabled: boolean;
  priority: number; // Lower is higher priority
  models: {
    cheap: string;
    standard: string;
    strong: string;
  };
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

// Task types for routing
export type AITask =
  | 'simple_completion'
  | 'complex_analysis'
  | 'summarization'
  | 'classification'
  | 'generation';

// Routing request
export interface AIRoutingRequest {
  task: AITask;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  context: {
    userId: string;
    tenantId: string;
    traceId: string;
    requestId?: string;
  };
}

// Routing response with telemetry
export interface AIRoutingResponse extends AICompletionResponse {
  providerId: string;
  modelUsed: string;
  costEstimate: number;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  processingTime: number;
}

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// AI Router Service
class AIRouterService {
  private providers: Map<string, ProviderConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor() {
    this.initializeProviders();
  }

  /**
   * Route AI request to optimal provider
   */
  async route(request: AIRoutingRequest): Promise<AIRoutingResponse> {
    const startTime = Date.now();

    // Select provider and model
    const { provider, model } = this.selectProvider(request.task);

    console.log(
      `[AIRouter] Routing ${request.task} to ${provider.id} (${model})`
    );

    try {
      // Get provider instance
      const aiProvider = this.getProviderInstance(provider.id);

      // Build AI request
      const aiRequest: AICompletionRequest = {
        model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 1000,
        metadata: {
          userId: request.context.userId,
          tenantId: request.context.tenantId,
          traceId: request.context.traceId,
          requestId: request.context.requestId,
          task: request.task,
        },
      };

      // Execute request
      const response = await aiProvider.complete(aiRequest);

      // Calculate cost
      const cost = this.calculateCost(
        provider,
        response.usage?.promptTokens || 0,
        response.usage?.completionTokens || 0
      );

      // Reset circuit breaker on success
      this.resetCircuitBreaker(provider.id);

      const processingTime = Date.now() - startTime;

      // Log telemetry
      console.log(
        `[AIRouter] Success: ${provider.id}/${model}, cost: $${cost.toFixed(4)}, time: ${processingTime}ms`
      );

      return {
        ...response,
        providerId: provider.id,
        modelUsed: model,
        costEstimate: cost,
        tokensUsed: {
          input: response.usage?.promptTokens || 0,
          output: response.usage?.completionTokens || 0,
          total: response.usage?.totalTokens || 0,
        },
        processingTime,
      };
    } catch (error) {
      // Record failure
      this.recordFailure(provider.id);

      // Try fallback
      console.error(
        `[AIRouter] Provider ${provider.id} failed:`,
        error instanceof Error ? error.message : error
      );

      // Check circuit breaker
      const breaker = this.circuitBreakers.get(provider.id);
      if (breaker && breaker.state === 'open') {
        throw new Error(
          `Provider ${provider.id} circuit breaker open, no fallback available`
        );
      }

      throw error;
    }
  }

  /**
   * Select provider and model for task
   */
  private selectProvider(task: AITask): {
    provider: ProviderConfig;
    model: string;
  } {
    // Get enabled providers sorted by priority
    const enabledProviders = Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .filter((p) => {
        const breaker = this.circuitBreakers.get(p.id);
        return !breaker || breaker.state !== 'open';
      })
      .sort((a, b) => a.priority - b.priority);

    if (enabledProviders.length === 0) {
      throw new Error('No enabled AI providers available');
    }

    // Select first available provider
    const provider = enabledProviders[0];

    // Select model based on task
    let model: string;
    switch (task) {
      case 'complex_analysis':
        model = provider.models.strong;
        break;
      case 'simple_completion':
      case 'summarization':
      case 'classification':
        model = provider.models.cheap;
        break;
      case 'generation':
        model = provider.models.standard;
        break;
      default:
        model = provider.models.standard;
    }

    return { provider, model };
  }

  /**
   * Get provider instance
   */
  private getProviderInstance(providerId: string): AIProvider {
    // For now, only OpenAI is implemented
    if (providerId === 'openai') {
      return getOpenAIProvider();
    }

    throw new Error(`Provider not implemented: ${providerId}`);
  }

  /**
   * Calculate cost for request
   */
  private calculateCost(
    provider: ProviderConfig,
    inputTokens: number,
    outputTokens: number
  ): number {
    const inputCost = (inputTokens / 1000) * provider.costPer1kTokens.input;
    const outputCost = (outputTokens / 1000) * provider.costPer1kTokens.output;
    return inputCost + outputCost;
  }

  /**
   * Record provider failure
   */
  private recordFailure(providerId: string): void {
    let breaker = this.circuitBreakers.get(providerId);
    if (!breaker) {
      breaker = { failures: 0, lastFailure: 0, state: 'closed' };
      this.circuitBreakers.set(providerId, breaker);
    }

    breaker.failures += 1;
    breaker.lastFailure = Date.now();

    // Open circuit if threshold exceeded
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      console.warn(
        `[AIRouter] Circuit breaker opened for provider ${providerId}`
      );

      // Auto-reset after timeout
      setTimeout(() => {
        breaker!.state = 'half-open';
        console.log(
          `[AIRouter] Circuit breaker half-open for provider ${providerId}`
        );
      }, this.CIRCUIT_BREAKER_TIMEOUT);
    }
  }

  /**
   * Reset circuit breaker on success
   */
  private resetCircuitBreaker(providerId: string): void {
    const breaker = this.circuitBreakers.get(providerId);
    if (breaker) {
      breaker.failures = 0;
      breaker.state = 'closed';
    }
  }

  /**
   * Initialize provider configurations
   */
  private initializeProviders(): void {
    // OpenAI (default, available now)
    this.providers.set('openai', {
      id: 'openai',
      type: 'openai',
      enabled: true,
      priority: 1,
      models: {
        cheap: 'gpt-3.5-turbo',
        standard: 'gpt-4-turbo',
        strong: 'gpt-4',
      },
      costPer1kTokens: {
        input: 0.0015, // gpt-3.5-turbo
        output: 0.002,
      },
    });

    // Azure OpenAI (ready for configuration)
    this.providers.set('azure', {
      id: 'azure',
      type: 'azure',
      enabled: false, // Enable when configured
      priority: 2,
      models: {
        cheap: 'gpt-35-turbo',
        standard: 'gpt-4-turbo',
        strong: 'gpt-4',
      },
      costPer1kTokens: {
        input: 0.0015,
        output: 0.002,
      },
    });

    // AWS Bedrock (ready for configuration)
    this.providers.set('bedrock', {
      id: 'bedrock',
      type: 'bedrock',
      enabled: false,
      priority: 3,
      models: {
        cheap: 'anthropic.claude-instant-v1',
        standard: 'anthropic.claude-v2',
        strong: 'anthropic.claude-v2',
      },
      costPer1kTokens: {
        input: 0.008,
        output: 0.024,
      },
    });

    // Google Vertex AI (ready for configuration)
    this.providers.set('vertex', {
      id: 'vertex',
      type: 'vertex',
      enabled: false,
      priority: 4,
      models: {
        cheap: 'text-bison',
        standard: 'chat-bison',
        strong: 'chat-bison-32k',
      },
      costPer1kTokens: {
        input: 0.001,
        output: 0.002,
      },
    });
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Record<
    string,
    { enabled: boolean; state: string; failures: number }
  > {
    const status: Record<
      string,
      { enabled: boolean; state: string; failures: number }
    > = {};

    for (const [id, config] of this.providers.entries()) {
      const breaker = this.circuitBreakers.get(id) || {
        failures: 0,
        state: 'closed',
      };
      status[id] = {
        enabled: config.enabled,
        state: breaker.state,
        failures: breaker.failures,
      };
    }

    return status;
  }
}

// Singleton instance
let aiRouterInstance: AIRouterService | null = null;

export function getAIRouter(): AIRouterService {
  if (!aiRouterInstance) {
    aiRouterInstance = new AIRouterService();
  }
  return aiRouterInstance;
}
