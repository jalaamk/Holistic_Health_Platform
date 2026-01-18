/**
 * WellnessOS Core Types
 * Phase 0: Foundation types for multi-tenancy, identity, and events
 */

/**
 * Tenant model - supports consumer, pro, and enterprise tiers
 */
export enum TenantTier {
  CONSUMER = 'consumer',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export interface Tenant {
  id: string;
  tier: TenantTier;
  name: string;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Entitlements
  entitlements: {
    features: string[];
    quotas: Record<string, number>;
  };
  
  // Compliance
  compliancePolicy?: {
    retention: number; // days
    dataResidency?: string;
    aiPermissions: string[];
  };
}

/**
 * User identity - tenant-scoped
 */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName?: string;
  roles: string[];
  
  // External IDP mapping (for SSO/SCIM)
  externalOrgId?: string;
  externalUserId?: string;
  idpProvider?: string;
  scimProvisioned?: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request context - propagated through all operations
 */
export interface RequestContext {
  requestId: string;
  traceId: string;
  userId: string;
  tenantId: string;
  deviceId?: string;
  roles: string[];
  entitlements: string[];
  timestamp: Date;
}

/**
 * Data classification for privacy/security controls
 */
export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  SENSITIVE = 'sensitive',
  PHI = 'phi',
}

/**
 * Consent scopes - gate tracking and AI actions
 */
export enum ConsentScope {
  NUTRITION = 'nutrition',
  MOVEMENT = 'movement',
  SLEEP = 'sleep',
  HABITS = 'habits',
  MIND = 'mind',
  SENSORS = 'sensors',
  AI_COACH = 'ai_coach',
  SHARING = 'sharing',
  ANALYTICS = 'analytics',
}

/**
 * Event envelope - all events flow through this structure
 * Implements taxonomy from Section 5.3 of the blueprint
 */
export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: string; // e.g., 'nutrition.meal.logged'
  occurredAt: string; // ISO 8601
  tenantId: string | null;
  userId: string;
  
  actor: {
    type: 'user' | 'system' | 'pro';
    id: string;
  };
  
  classification: DataClassification;
  consentScope?: ConsentScope;
  traceId: string;
  
  data: T;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

/**
 * Pagination
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
    cursor?: string;
  };
}

/**
 * Profile Spine - canonical user profile
 * Section 4.1 of the blueprint
 */
export interface ProfileSpine {
  userId: string;
  tenantId: string;
  version: number; // for optimistic concurrency
  
  // Identity
  identity: {
    displayName?: string;
    locale: string;
    timezone: string;
  };
  
  // Preferences
  preferences: Record<string, unknown>;
  
  // Constraints (allergies, restrictions, etc.)
  constraints: Record<string, unknown>;
  
  // Consent registry
  consent: {
    scopes: ConsentScope[];
    grantedAt: Record<ConsentScope, string>;
    revokedAt?: Record<ConsentScope, string>;
  };
  
  // Policy references
  policyRefs: string[];
  
  // Computed summaries (with explainability)
  computed?: {
    adherenceScore?: {
      value: number;
      confidence: number;
      reasonCodes: string[];
      computedAt: string;
    };
    riskFlags?: string[];
  };
  
  // Entitlements pointer
  entitlements: {
    plan: string;
    limits: Record<string, number>;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entitlement check result
 */
export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  quotaRemaining?: number;
}
