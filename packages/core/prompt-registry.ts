import { z, ZodSchema } from 'zod';

// Prompt metadata and versioning
export interface PromptDefinition {
  promptId: string;
  version: number;
  owner: string;
  template: string;
  description?: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  evalCases: EvalCase[];
  safetyNotes?: string;
  rolloutFlags: RolloutFlags;
  createdAt: string;
  updatedAt: string;
}

export interface EvalCase {
  name: string;
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  minConfidence?: number;
  description?: string;
}

export interface RolloutFlags {
  enabled: boolean;
  percentage: number; // 0-100
  allowlist?: string[]; // tenantIds or userIds
  blocklist?: string[];
}

export interface RegisterPromptInput {
  promptId: string;
  version: number;
  owner: string;
  template: string;
  description?: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  evalCases: EvalCase[];
  safetyNotes?: string;
  rolloutFlags?: Partial<RolloutFlags>;
}

// Prompt Registry Service
class PromptRegistryService {
  private prompts: Map<string, Map<number, PromptDefinition>> = new Map();

  constructor() {
    this.initializeBuiltInPrompts();
  }

  /**
   * Register a new prompt or version
   */
  async register(input: RegisterPromptInput): Promise<PromptDefinition> {
    const now = new Date().toISOString();

    const prompt: PromptDefinition = {
      promptId: input.promptId,
      version: input.version,
      owner: input.owner,
      template: input.template,
      description: input.description,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      evalCases: input.evalCases,
      safetyNotes: input.safetyNotes,
      rolloutFlags: {
        enabled: input.rolloutFlags?.enabled ?? true,
        percentage: input.rolloutFlags?.percentage ?? 100,
        allowlist: input.rolloutFlags?.allowlist,
        blocklist: input.rolloutFlags?.blocklist,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Validate schemas
    this.validatePrompt(prompt);

    // Store prompt
    if (!this.prompts.has(input.promptId)) {
      this.prompts.set(input.promptId, new Map());
    }
    this.prompts.get(input.promptId)!.set(input.version, prompt);

    console.log(
      `[PromptRegistry] Registered prompt ${input.promptId} v${input.version}`
    );

    return prompt;
  }

  /**
   * Get a specific prompt version
   */
  async getPrompt(
    promptId: string,
    version?: number
  ): Promise<PromptDefinition> {
    const versions = this.prompts.get(promptId);
    if (!versions || versions.size === 0) {
      throw new Error(`Prompt not found: ${promptId}`);
    }

    // If version specified, get that version
    if (version !== undefined) {
      const prompt = versions.get(version);
      if (!prompt) {
        throw new Error(`Prompt version not found: ${promptId} v${version}`);
      }
      return prompt;
    }

    // Otherwise get latest version
    const latestVersion = Math.max(...versions.keys());
    return versions.get(latestVersion)!;
  }

  /**
   * List all versions of a prompt
   */
  async listVersions(promptId: string): Promise<PromptDefinition[]> {
    const versions = this.prompts.get(promptId);
    if (!versions) {
      return [];
    }
    return Array.from(versions.values()).sort(
      (a, b) => b.version - a.version
    );
  }

  /**
   * List all prompts
   */
  async listPrompts(): Promise<string[]> {
    return Array.from(this.prompts.keys());
  }

  /**
   * Check if prompt is enabled for given context
   */
  async isEnabled(
    promptId: string,
    version: number,
    context: { tenantId?: string; userId?: string }
  ): Promise<boolean> {
    const prompt = await this.getPrompt(promptId, version);
    const flags = prompt.rolloutFlags;

    // Check enabled flag
    if (!flags.enabled) {
      return false;
    }

    // Check blocklist
    if (flags.blocklist) {
      if (
        (context.tenantId && flags.blocklist.includes(context.tenantId)) ||
        (context.userId && flags.blocklist.includes(context.userId))
      ) {
        return false;
      }
    }

    // Check allowlist (if present, must be in list)
    if (flags.allowlist && flags.allowlist.length > 0) {
      return (
        (context.tenantId && flags.allowlist.includes(context.tenantId)) ||
        (context.userId && flags.allowlist.includes(context.userId))
      );
    }

    // Check percentage rollout (simple hash-based for consistency)
    if (flags.percentage < 100) {
      const key = context.tenantId || context.userId || 'unknown';
      const hash = this.simpleHash(key);
      const threshold = (flags.percentage / 100) * 0xffffffff;
      return hash < threshold;
    }

    return true;
  }

  /**
   * Interpolate template with variables
   */
  async interpolate(
    promptId: string,
    version: number | undefined,
    variables: Record<string, unknown>
  ): Promise<string> {
    const prompt = await this.getPrompt(promptId, version);

    // Validate input against schema
    prompt.inputSchema.parse(variables);

    // Simple template interpolation
    let result = prompt.template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = JSON.stringify(value, null, 2);
      result = result.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return result;
  }

  /**
   * Validate output against schema
   */
  async validateOutput(
    promptId: string,
    version: number | undefined,
    output: unknown
  ): Promise<boolean> {
    const prompt = await this.getPrompt(promptId, version);
    try {
      prompt.outputSchema.parse(output);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run evaluation cases
   */
  async runEvals(
    promptId: string,
    version: number | undefined
  ): Promise<EvalResult[]> {
    const prompt = await this.getPrompt(promptId, version);
    const results: EvalResult[] = [];

    for (const evalCase of prompt.evalCases) {
      results.push({
        caseName: evalCase.name,
        passed: false,
        message: 'Eval execution not implemented (requires AI call)',
        expectedOutput: evalCase.expectedOutput,
        minConfidence: evalCase.minConfidence,
      });
    }

    return results;
  }

  /**
   * Initialize built-in prompts
   */
  private initializeBuiltInPrompts(): void {
    // Habit Insights Prompt
    this.register({
      promptId: 'generate_habit_insights',
      version: 1,
      owner: 'habits_team',
      description: 'Analyze habit completion patterns and generate insights',
      template: `Analyze the following habit completion data and provide insights:

Habits: {{habits}}
Completions: {{completions}}
Timeframe: {{timeframe}}

Provide:
1. Key patterns observed
2. Areas of strength
3. Improvement opportunities
4. Specific actionable recommendations

Format the response as JSON with "insights" and "recommendations" arrays.`,
      inputSchema: z.object({
        habits: z.array(z.any()),
        completions: z.array(z.any()),
        timeframe: z.string(),
      }),
      outputSchema: z.object({
        insights: z.array(
          z.object({
            type: z.string(),
            message: z.string(),
            confidence: z.number().min(0).max(1),
          })
        ),
        recommendations: z.array(
          z.object({
            priority: z.enum(['high', 'medium', 'low']),
            action: z.string(),
            rationale: z.string(),
          })
        ),
      }),
      evalCases: [
        {
          name: 'typical_habit_analysis',
          input: {
            habits: [{ name: 'Morning meditation', category: 'mindfulness' }],
            completions: [],
            timeframe: '7d',
          },
          expectedOutput: {
            insights: [],
            recommendations: [],
          },
          minConfidence: 0.7,
        },
      ],
      safetyNotes: 'Ensure recommendations are positive and constructive',
      rolloutFlags: { enabled: true, percentage: 100 },
    });

    // Nutrition Insights Prompt
    this.register({
      promptId: 'generate_nutrition_insights',
      version: 1,
      owner: 'nutrition_team',
      description: 'Analyze nutrition data and provide dietary insights',
      template: `Analyze the following nutrition data:

Daily Summary: {{dailySummary}}
Goals: {{goals}}
Recent Meals: {{recentMeals}}

Provide insights on:
1. Macro balance (protein, carbs, fats)
2. Calorie tracking vs goals
3. Nutritional quality
4. Suggestions for improvement

Format as JSON with "insights" and "suggestions" arrays.`,
      inputSchema: z.object({
        dailySummary: z.any(),
        goals: z.any(),
        recentMeals: z.array(z.any()),
      }),
      outputSchema: z.object({
        insights: z.array(
          z.object({
            category: z.string(),
            message: z.string(),
            confidence: z.number(),
          })
        ),
        suggestions: z.array(z.string()),
      }),
      evalCases: [],
      rolloutFlags: { enabled: true, percentage: 100 },
    });

    // Weekly Summary Prompt
    this.register({
      promptId: 'generate_weekly_summary',
      version: 1,
      owner: 'insights_team',
      description: 'Create comprehensive weekly wellness summary',
      template: `Create a weekly wellness summary based on:

Habits: {{habits}}
Nutrition: {{nutrition}}
Sleep: {{sleep}}
Movement: {{movement}}
Mood: {{mood}}

Provide:
1. Overall wellness score (0-100)
2. Domain-specific insights
3. Highlights and achievements
4. Areas for improvement
5. Actionable recommendations

Format as JSON matching the expected schema.`,
      inputSchema: z.object({
        habits: z.any(),
        nutrition: z.any(),
        sleep: z.any(),
        movement: z.any(),
        mood: z.any().optional(),
      }),
      outputSchema: z.object({
        overallScore: z.number().min(0).max(100),
        insights: z.array(z.any()),
        highlights: z.array(z.string()),
        recommendations: z.array(z.any()),
      }),
      evalCases: [],
      rolloutFlags: { enabled: true, percentage: 100 },
    });

    // Sleep Quality Analysis Prompt
    this.register({
      promptId: 'analyze_sleep_quality',
      version: 1,
      owner: 'sleep_team',
      description: 'Analyze sleep patterns and provide recommendations',
      template: `Analyze sleep patterns:

Sleep Data: {{sleepData}}
Sleep Goals: {{goals}}
Timeframe: {{timeframe}}

Provide:
1. Sleep quality assessment
2. Pattern observations
3. Recommendations for better sleep

Format as JSON with "assessment", "patterns", and "recommendations".`,
      inputSchema: z.object({
        sleepData: z.any(),
        goals: z.any(),
        timeframe: z.string(),
      }),
      outputSchema: z.object({
        assessment: z.object({
          quality: z.string(),
          score: z.number(),
        }),
        patterns: z.array(z.string()),
        recommendations: z.array(z.string()),
      }),
      evalCases: [],
      rolloutFlags: { enabled: true, percentage: 100 },
    });
  }

  /**
   * Validate prompt definition
   */
  private validatePrompt(prompt: PromptDefinition): void {
    if (!prompt.promptId || prompt.promptId.trim() === '') {
      throw new Error('promptId is required');
    }
    if (prompt.version < 1) {
      throw new Error('version must be >= 1');
    }
    if (!prompt.template || prompt.template.trim() === '') {
      throw new Error('template is required');
    }
  }

  /**
   * Simple hash function for rollout percentage
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

interface EvalResult {
  caseName: string;
  passed: boolean;
  message: string;
  expectedOutput: Record<string, unknown>;
  actualOutput?: Record<string, unknown>;
  minConfidence?: number;
  actualConfidence?: number;
}

// Singleton instance
let promptRegistryInstance: PromptRegistryService | null = null;

export function getPromptRegistry(): PromptRegistryService {
  if (!promptRegistryInstance) {
    promptRegistryInstance = new PromptRegistryService();
  }
  return promptRegistryInstance;
}
