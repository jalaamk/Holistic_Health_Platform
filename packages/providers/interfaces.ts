/**
 * WellnessOS Provider Interfaces
 * Phase 0: Portability layer - interfaces before implementations
 * 
 * These interfaces abstract vendor dependencies (Firebase, OpenAI)
 * to enable future migration without architectural rewrites.
 * See Section 2.4 and Section 11 of the blueprint.
 */

import type { User, Tenant } from '@/packages/types';

/**
 * Identity Provider Interface
 * Abstracts Firebase Auth -> enables migration to WorkOS/Auth0/Okta/Cognito
 */
export interface IdentityProvider {
  /**
   * Verify authentication token and return user claims
   */
  verifyToken(token: string): Promise<AuthTokenClaims>;
  
  /**
   * Get user by ID
   */
  getUser(userId: string): Promise<User | null>;
  
  /**
   * Create new user
   */
  createUser(data: CreateUserData): Promise<User>;
  
  /**
   * Update user
   */
  updateUser(userId: string, data: Partial<User>): Promise<User>;
  
  /**
   * Delete user
   */
  deleteUser(userId: string): Promise<void>;
  
  /**
   * Generate custom token (for session management)
   */
  createCustomToken(userId: string, claims?: Record<string, unknown>): Promise<string>;
}

export interface AuthTokenClaims {
  userId: string;
  email: string;
  tenantId?: string;
  roles?: string[];
  expiresAt: number;
}

export interface CreateUserData {
  email: string;
  password?: string;
  displayName?: string;
  tenantId: string;
  roles?: string[];
}

/**
 * Data Store Interface
 * Abstracts Firestore -> enables migration to Postgres/MongoDB/DynamoDB
 */
export interface DataStore {
  /**
   * Get document by ID
   */
  get<T>(collection: string, id: string): Promise<T | null>;
  
  /**
   * Query documents
   */
  query<T>(collection: string, filters: QueryFilter[]): Promise<T[]>;
  
  /**
   * Create document
   */
  create<T>(collection: string, id: string, data: T): Promise<T>;
  
  /**
   * Update document
   */
  update<T>(collection: string, id: string, data: Partial<T>): Promise<T>;
  
  /**
   * Delete document
   */
  delete(collection: string, id: string): Promise<void>;
  
  /**
   * Batch operations (atomic)
   */
  batch(operations: BatchOperation[]): Promise<void>;
  
  /**
   * Transaction support
   */
  runTransaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T>;
}

export interface QueryFilter {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
  value: unknown;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  id: string;
  data?: unknown;
}

export interface Transaction {
  get<T>(collection: string, id: string): Promise<T | null>;
  create<T>(collection: string, id: string, data: T): void;
  update<T>(collection: string, id: string, data: Partial<T>): void;
  delete(collection: string, id: string): void;
}

/**
 * AI Provider Interface
 * Abstracts OpenAI -> enables migration to Azure/Bedrock/Vertex/self-hosted
 */
export interface AIProvider {
  /**
   * Generate completion
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  
  /**
   * Generate embeddings
   */
  embed(texts: string[]): Promise<number[][]>;
  
  /**
   * Get model info
   */
  getModelInfo(model: string): ModelInfo;
}

export interface AICompletionRequest {
  promptId: string;
  promptVersion: string;
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  userId: string;
  tenantId: string;
  context: Record<string, unknown>;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  costEstimate: number;
  finishReason: string;
  
  // Explainability
  reasonCodes?: string[];
  confidence?: number;
  evidencePack?: Record<string, unknown>;
}

export interface ModelInfo {
  name: string;
  provider: string;
  contextWindow: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

/**
 * Repository Pattern
 * Domain-specific data access
 */
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findByTenantId(tenantId: string): Promise<T[]>;
  create(data: T): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

/**
 * Tenant Repository
 */
export interface TenantRepository extends Repository<Tenant> {
  findByPlan(plan: string): Promise<Tenant[]>;
}

/**
 * User Repository
 */
export interface UserRepository extends Repository<User> {
  findByEmail(email: string): Promise<User | null>;
  findByTenantId(tenantId: string): Promise<User[]>;
}

/**
 * Event Bus Interface
 * For event-driven architecture (Section 5.4)
 */
export interface EventBus {
  /**
   * Publish event
   */
  publish<T>(event: EventEnvelope<T>): Promise<void>;
  
  /**
   * Subscribe to events
   */
  subscribe<T>(
    eventType: string,
    handler: (event: EventEnvelope<T>) => Promise<void>,
    options?: SubscriptionOptions
  ): Subscription;
  
  /**
   * Unsubscribe
   */
  unsubscribe(subscription: Subscription): Promise<void>;
}

export interface EventEnvelope<T> {
  eventId: string;
  type: string;
  occurredAt: string;
  tenantId: string | null;
  userId: string;
  actor: { type: string; id: string };
  classification: string;
  consentScope?: string;
  traceId: string;
  data: T;
}

export interface SubscriptionOptions {
  idempotencyKey?: string;
  deadLetterQueue?: boolean;
}

export interface Subscription {
  id: string;
  eventType: string;
}
