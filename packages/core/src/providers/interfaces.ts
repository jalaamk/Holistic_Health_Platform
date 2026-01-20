/**
 * Provider Interfaces
 * These abstract external dependencies to enable portability
 */

import { User, RequestContext } from '../models/types';

// ============================================================================
// Identity Provider - Abstracts Firebase Auth, WorkOS, Auth0, Okta, etc.
// ============================================================================

export interface IdentityProvider {
  // Authentication
  verifyToken(token: string): Promise<TokenPayload>;
  createUser(params: CreateUserParams): Promise<User>;
  updateUser(userId: string, params: UpdateUserParams): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  
  // Session management
  refreshToken(refreshToken: string): Promise<TokenPair>;
  revokeToken(token: string): Promise<void>;
  
  // MFA
  enableMFA(userId: string): Promise<MFASetup>;
  verifyMFA(userId: string, code: string): Promise<boolean>;
  
  // Metadata
  getProviderInfo(): ProviderInfo;
}

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  expiresAt: Date;
}

export interface CreateUserParams {
  email: string;
  password?: string;
  displayName?: string;
  tenantId: string;
  roles: string[];
  externalUserId?: string;
  idpProvider?: string;
}

export interface UpdateUserParams {
  email?: string;
  displayName?: string;
  roles?: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

// ============================================================================
// Data Store Provider - Abstracts Firestore, Postgres, MongoDB, etc.
// ============================================================================

export interface DataStoreProvider {
  // Basic operations
  get<T>(collection: string, id: string, context: RequestContext): Promise<T | null>;
  query<T>(collection: string, query: Query, context: RequestContext): Promise<T[]>;
  create<T>(collection: string, data: T, context: RequestContext): Promise<T>;
  update<T>(collection: string, id: string, data: Partial<T>, context: RequestContext): Promise<T>;
  delete(collection: string, id: string, context: RequestContext): Promise<void>;
  
  // Batch operations
  batchGet<T>(collection: string, ids: string[], context: RequestContext): Promise<T[]>;
  batchWrite(operations: BatchOperation[], context: RequestContext): Promise<void>;
  
  // Transactions
  runTransaction<T>(fn: (tx: Transaction) => Promise<T>, context: RequestContext): Promise<T>;
  
  // Metadata
  getProviderInfo(): ProviderInfo;
}

export interface Query {
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  cursor?: string;
}

export interface WhereClause {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
  value: unknown;
}

export interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  id?: string;
  data?: unknown;
}

export interface Transaction {
  get<T>(collection: string, id: string): Promise<T | null>;
  create<T>(collection: string, data: T): void;
  update<T>(collection: string, id: string, data: Partial<T>): void;
  delete(collection: string, id: string): void;
}

// ============================================================================
// AI Provider - Abstracts OpenAI, Azure OpenAI, Bedrock, Vertex, etc.
// ============================================================================

export interface AIProvider {
  // Text generation
  complete(params: CompletionParams, context: RequestContext): Promise<CompletionResponse>;
  
  // Embeddings
  embed(params: EmbeddingParams, context: RequestContext): Promise<EmbeddingResponse>;
  
  // Moderation
  moderate(content: string, context: RequestContext): Promise<ModerationResponse>;
  
  // Metadata
  getProviderInfo(): ProviderInfo;
  estimateCost(params: CompletionParams): number;
}

export interface CompletionParams {
  promptId: string;
  promptVersion: string;
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionResponse {
  id: string;
  content: string;
  finishReason: string;
  usage: TokenUsage;
  model: string;
  latencyMs: number;
  cached: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EmbeddingParams {
  input: string | string[];
  model: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  usage: TokenUsage;
}

export interface ModerationResponse {
  flagged: boolean;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
}

// ============================================================================
// Secrets Vault - Abstracts KMS, Vault, etc.
// ============================================================================

export interface SecretsVaultProvider {
  getSecret(key: string, context: RequestContext): Promise<string>;
  setSecret(key: string, value: string, context: RequestContext): Promise<void>;
  deleteSecret(key: string, context: RequestContext): Promise<void>;
  rotateSecret(key: string, context: RequestContext): Promise<void>;
  listSecrets(prefix: string, context: RequestContext): Promise<string[]>;
  getProviderInfo(): ProviderInfo;
}

// ============================================================================
// Common
// ============================================================================

export interface ProviderInfo {
  name: string;
  version: string;
  vendor: string;
  capabilities: string[];
}
