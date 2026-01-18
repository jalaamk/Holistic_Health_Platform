import { z } from 'zod';

/**
 * Environment validation schema
 * WellnessOS Phase 0: Typed environment validation
 */
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Firebase Client (Public)
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API key is required'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase auth domain is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase project ID is required'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase storage bucket is required'),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, 'Firebase sender ID is required'),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Firebase app ID is required'),
  
  // Firebase Admin (Server-side)
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1, 'Firebase admin project ID is required'),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email('Valid Firebase admin email is required'),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1, 'Firebase admin private key is required'),
  
  // OpenAI
  OPENAI_API_KEY: z.string().startsWith('sk-', 'OpenAI API key must start with sk-'),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url('Valid app URL is required'),
  
  // Security
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  
  // Feature Flags
  NEXT_PUBLIC_ENABLE_AI_FEATURES: z.string().optional().default('true'),
  NEXT_PUBLIC_ENABLE_PROFESSIONAL_SUITE: z.string().optional().default('false'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and returns typed environment variables
 * Throws on validation failure to prevent app startup with invalid config
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = error.issues
        .map((err: z.ZodIssue) => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      
      throw new Error(
        `❌ Invalid environment variables:\n${formatted}\n\n` +
        `Please check your .env file against .env.example`
      );
    }
    throw error;
  }
}

// Singleton instance for server-side use
let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

// Export for type checking
export default envSchema;
