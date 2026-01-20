/**
 * Core types for WellnessOS
 * These types are used throughout the system
 */

// Tenant & Identity
export type TenantTier = 'consumer' | 'pro' | 'enterprise';

export interface Tenant {
  id: string;
  tier: TenantTier;
  name: string;
  plan: string;
  entitlements: Entitlements;
  compliancePolicy: CompliancePolicy;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName?: string;
  roles: UserRole[];
  externalUserId?: string;
  idpProvider?: string;
  scimProvisioned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'org-admin' | 'pro' | 'staff' | 'member' | 'viewer' | 'support';

// Entitlements & Quotas
export interface Entitlements {
  features: Record<string, boolean>;
  quotas: Record<string, Quota>;
  aiEnabled: boolean;
  aiMonthlyTokenLimit?: number;
  integrationsEnabled: boolean;
  maxIntegrations?: number;
}

export interface Quota {
  limit: number;
  used: number;
  resetAt: Date;
}

// Compliance & Policy
export interface CompliancePolicy {
  dataRetentionDays: number;
  auditRetentionDays: number;
  allowAI: boolean;
  allowSharing: boolean;
  requireMFA: boolean;
  allowedRegions?: string[];
}

// Data Classification
export type DataClassification = 'public' | 'internal' | 'sensitive' | 'phi';

// Request Context
export interface RequestContext {
  requestId: string;
  traceId: string;
  tenantId: string;
  userId: string;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  featureFlags: Record<string, boolean>;
  entitlements: Entitlements;
}

// API Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: Date;
  latencyMs: number;
  version: string;
}

// Pagination
export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount?: number;
}

// Audit
export interface AuditEntry {
  id: string;
  tenantId: string;
  timestamp: Date;
  actor: Actor;
  action: string;
  resource: string;
  resourceId: string;
  classification: DataClassification;
  reason?: string;
  requestId: string;
  traceId: string;
  metadata?: Record<string, unknown>;
}

export interface Actor {
  type: 'user' | 'system' | 'pro' | 'service';
  id: string;
  displayName?: string;
}
