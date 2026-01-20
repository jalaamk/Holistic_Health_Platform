/**
 * Environment Configuration and Validation
 * Ensures all required environment variables are present and properly typed
 */

import { z } from 'zod';

// Environment Schema
const envSchema = z.object({
  // Firebase
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_ORGANIZATION_ID: z.string().optional(),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  
  // Security
  SESSION_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  
  // Feature Flags
  NEXT_PUBLIC_ENABLE_AI_FEATURES: z.string().transform(val => val === 'true').default('false'),
  NEXT_PUBLIC_ENABLE_INTEGRATIONS: z.string().transform(val => val === 'true').default('false'),
  NEXT_PUBLIC_ENABLE_PAYMENTS: z.string().transform(val => val === 'true').default('false'),
  
  // Observability
  ENABLE_TELEMETRY: z.string().transform(val => val === 'true').default('true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.string().transform(val => val === 'true').default('true'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(val => parseInt(val, 10)).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(val => parseInt(val, 10)).default('100'),
});

export type Env = z.infer<typeof envSchema>;

// Validate and export environment
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
}

// Lazy-loaded singleton
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

// For testing
export function resetEnv(): void {
  cachedEnv = null;
}
