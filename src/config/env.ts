import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // Firebase Config (Public - Client Side)
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  
  // Firebase Admin (Server Side)
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

// Validate and parse environment variables (lazy)
function validateEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }
  
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  
  cachedEnv = parsed.data;
  return cachedEnv;
}

// Export a getter function instead of immediate validation
export function getEnv(): Env {
  return validateEnv();
}

// For convenience, also export env that validates on first access
export const env = new Proxy({} as Env, {
  get(target, prop: string) {
    const validatedEnv = validateEnv();
    return validatedEnv[prop as keyof Env];
  },
});
