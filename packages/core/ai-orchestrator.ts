import { getPromptRegistry } from './prompt-registry';
import { getAIRouter, type AITask } from './ai-router';
import { getPolicyConsentService } from './policy-consent';
import { getEntitlementsService } from './entitlements';
import type { RequestContext } from '../types';
import { DataClassification, ConsentScope } from '../types';

// AI Execution Request
export interface AIExecutionRequest {
  promptId: string;
  version?: number; // undefined = latest
  context: RequestContext;
  input: Record<string, unknown>;
  options?: {
    temperature?: number;
    maxTokens?: number;
    task?: AITask;
  };
}

// AI Execution Result with Explainability
export interface AIExecutionResult<T = unknown> {
  output: T;
  explainability: AIExplainability;
}

export interface AIExplainability {
  reasonCodes: string[];
  confidence: number; // 0-1
  evidencePack?: Record<string, unknown>;
  modelUsed: string;
  costEstimate: number;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  processingTime: number;
  providerId: string;
}

// AI Orchestrator Service
class AIOrchestratorService {
  private initialized = false;

  /**
   * Initialize AI Orchestrator
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    console.log('[AIOrchestrator] Initializing...');
    
    // Ensure dependencies are ready
    getPromptRegistry();
    getAIRouter();
    
    this.initialized = true;
    console.log('[AIOrchestrator] Initialized successfully');
  }

  /**
   * Execute AI prompt with full governance
   */
  async execute<T = unknown>(
    request: AIExecutionRequest
  ): Promise<AIExecutionResult<T>> {
    const startTime = Date.now();

    console.log(
      `[AIOrchestrator] Executing prompt ${request.promptId} v${request.version || 'latest'}`
    );

    try {
      // 1. Get prompt from registry
      const promptRegistry = getPromptRegistry();
      const prompt = await promptRegistry.getPrompt(
        request.promptId,
        request.version
      );

      // 2. Check if prompt is enabled for this context
      const isEnabled = await promptRegistry.isEnabled(
        request.promptId,
        prompt.version,
        {
          tenantId: request.context.tenantId,
          userId: request.context.userId,
        }
      );

      if (!isEnabled) {
        throw new Error(
          `Prompt ${request.promptId} v${prompt.version} is not enabled for this context`
        );
      }

      // 3. Policy evaluation (check consent for AI usage)
      const policyService = getPolicyConsentService();
      const policyDecision = await policyService.evaluate(
        request.context,
        'ai.inference',
        'execute',
        DataClassification.INTERNAL
      );

      if (!policyDecision.allowed) {
        throw new Error(
          `AI execution not allowed: ${policyDecision.reason}`
        );
      }

      // 4. Check AI consent scope
      const hasConsent = await policyService.checkConsent(
        request.context.userId,
        request.context.tenantId,
        ConsentScope.AI_COACH
      );

      if (!hasConsent) {
        throw new Error(
          'User has not granted consent for AI features (ai_coach scope)'
        );
      }

      // 5. Check entitlements and quota
      const entitlementsService = getEntitlementsService();
      const featureAccess = await entitlementsService.checkFeature(
        request.context.tenantId,
        'ai_insights'
      );

      if (!featureAccess.allowed) {
        throw new Error('AI insights feature not available for this plan');
      }

      const quotaCheck = await entitlementsService.checkQuota(
        request.context.tenantId,
        'aiRequests',
        1
      );

      if (!quotaCheck.allowed) {
        throw new Error(
          `AI quota exceeded: ${quotaCheck.reason || 'Quota limit reached'}`
        );
      }

      // 6. Interpolate prompt template
      const interpolatedPrompt = await promptRegistry.interpolate(
        request.promptId,
        prompt.version,
        request.input
      );

      // 7. Route to AI provider
      const router = getAIRouter();
      const task = request.options?.task || 'complex_analysis';

      const aiResponse = await router.route({
        task,
        prompt: interpolatedPrompt,
        temperature: request.options?.temperature,
        maxTokens: request.options?.maxTokens,
        context: request.context,
      });

      // 8. Parse and validate output
      let parsedOutput: T;
      try {
        parsedOutput = JSON.parse(aiResponse.content) as T;
      } catch {
        throw new Error('Failed to parse AI output as JSON');
      }

      const isValid = await promptRegistry.validateOutput(
        request.promptId,
        prompt.version,
        parsedOutput
      );

      if (!isValid) {
        console.warn(
          `[AIOrchestrator] Output validation failed for ${request.promptId}`
        );
      }

      // 9. Increment usage quota
      await entitlementsService.incrementUsage(
        request.context.tenantId,
        'aiRequests'
      );

      // 10. Build explainability metadata
      const processingTime = Date.now() - startTime;
      const explainability: AIExplainability = {
        reasonCodes: this.extractReasonCodes(request.promptId, parsedOutput),
        confidence: this.calculateConfidence(parsedOutput),
        evidencePack: {
          promptId: request.promptId,
          promptVersion: prompt.version,
          inputKeys: Object.keys(request.input),
          task,
        },
        modelUsed: aiResponse.modelUsed,
        costEstimate: aiResponse.costEstimate,
        tokensUsed: aiResponse.tokensUsed,
        processingTime,
        providerId: aiResponse.providerId,
      };

      console.log(
        `[AIOrchestrator] Success: ${request.promptId}, cost: $${aiResponse.costEstimate.toFixed(4)}, time: ${processingTime}ms`
      );

      return {
        output: parsedOutput,
        explainability,
      };
    } catch (error) {
      console.error(
        `[AIOrchestrator] Execution failed for ${request.promptId}:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Extract reason codes from output
   */
  private extractReasonCodes(
    promptId: string,
    output: unknown
  ): string[] {
    const codes: string[] = [`prompt:${promptId}`];

    // Extract domain-specific reason codes from output structure
    if (typeof output === 'object' && output !== null) {
      const obj = output as Record<string, unknown>;

      if (Array.isArray(obj.insights)) {
        codes.push(`insights_count:${obj.insights.length}`);
        obj.insights.forEach((insight: any) => {
          if (insight.type) {
            codes.push(`insight_type:${insight.type}`);
          }
        });
      }

      if (Array.isArray(obj.recommendations)) {
        codes.push(`recommendations_count:${obj.recommendations.length}`);
      }

      if (typeof obj.overallScore === 'number') {
        codes.push(`overall_score:${obj.overallScore}`);
      }
    }

    return codes;
  }

  /**
   * Calculate confidence score from output
   */
  private calculateConfidence(output: unknown): number {
    // Default confidence
    let confidence = 0.8;

    if (typeof output === 'object' && output !== null) {
      const obj = output as Record<string, unknown>;

      // If output includes confidence, use it
      if (typeof obj.confidence === 'number') {
        confidence = obj.confidence;
      }

      // Average confidence from insights
      if (Array.isArray(obj.insights)) {
        const confidences = obj.insights
          .map((i: any) => i.confidence)
          .filter((c): c is number => typeof c === 'number');

        if (confidences.length > 0) {
          confidence =
            confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
        }
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    providers: Record<string, unknown>;
  }> {
    const router = getAIRouter();
    const providers = router.getProviderStatus();

    return {
      status: 'healthy',
      providers,
    };
  }
}

// Singleton instance
let aiOrchestratorInstance: AIOrchestratorService | null = null;

export function getAIOrchestrator(): AIOrchestratorService {
  if (!aiOrchestratorInstance) {
    aiOrchestratorInstance = new AIOrchestratorService();
  }
  return aiOrchestratorInstance;
}
