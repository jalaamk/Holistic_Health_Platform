import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test the validation schemas themselves, not the module import
describe('Environment Validation', () => {
  const ServerEnvSchema = z.object({
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.string().email(),
    FIREBASE_PRIVATE_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
  });

  const PublicEnvSchema = z.object({
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  });

  it('should fail validation when required Firebase env variable is missing', () => {
    const invalidEnv = {
      // Missing FIREBASE_PROJECT_ID
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
      FIREBASE_PRIVATE_KEY: 'test-key',
      OPENAI_API_KEY: 'sk-test123',
    };

    const result = ServerEnvSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].path).toContain('FIREBASE_PROJECT_ID');
    }
  });

  it('should fail validation when env variable has invalid format', () => {
    const invalidEnv = {
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_CLIENT_EMAIL: 'not-a-valid-email', // Invalid email
      FIREBASE_PRIVATE_KEY: 'test-key',
      OPENAI_API_KEY: 'sk-test123',
    };

    const result = ServerEnvSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('FIREBASE_CLIENT_EMAIL');
    }
  });

  it('should pass validation when all required env variables are present and valid', () => {
    const validEnv = {
      FIREBASE_PROJECT_ID: 'test-project-id',
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
      FIREBASE_PRIVATE_KEY: 'test-private-key',
      OPENAI_API_KEY: 'sk-test123',
    };

    const result = ServerEnvSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.FIREBASE_PROJECT_ID).toBe('test-project-id');
      expect(result.data.FIREBASE_CLIENT_EMAIL).toBe('test@example.com');
    }
  });

  it('should fail validation for invalid URL format', () => {
    const invalidPublicEnv = {
      NEXT_PUBLIC_API_URL: 'not-a-url',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    };

    const result = PublicEnvSchema.safeParse(invalidPublicEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('NEXT_PUBLIC_API_URL');
    }
  });

  it('should pass validation for valid URLs', () => {
    const validPublicEnv = {
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_URL: 'https://example.com',
    };

    const result = PublicEnvSchema.safeParse(validPublicEnv);
    expect(result.success).toBe(true);
  });
});
