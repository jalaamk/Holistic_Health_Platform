/**
 * Integrations Hub - Type Definitions
 * 
 * Defines interfaces for external integrations including wearables,
 * EHR/FHIR systems, and calendar providers.
 */

import { z } from 'zod';

// Integration Provider Types
export type IntegrationProvider = 
  | 'fitbit'
  | 'apple_health'
  | 'google_fit'
  | 'garmin'
  | 'whoop'
  | 'oura'
  | 'epic_fhir'
  | 'cerner_fhir'
  | 'google_calendar'
  | 'outlook_calendar';

export type IntegrationCategory = 'wearable' | 'ehr' | 'calendar';

export type IntegrationStatus = 
  | 'pending'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'error';

// OAuth Token Management
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string; // ISO timestamp
  scope: string[];
  tokenType: string;
}

export interface IntegrationConnection {
  id: string;
  tenantId: string;
  userId: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  status: IntegrationStatus;
  tokens: OAuthTokens;
  metadata: Record<string, unknown>;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Data Sync Types
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncJob {
  id: string;
  connectionId: string;
  tenantId: string;
  userId: string;
  provider: IntegrationProvider;
  dataType: string; // 'activity', 'sleep', 'heart_rate', 'nutrition', etc.
  status: SyncStatus;
  startedAt: string;
  completedAt?: string;
  recordsProcessed?: number;
  error?: string;
}

// Wearable Data Types
export interface WearableActivityData {
  provider: IntegrationProvider;
  externalId: string;
  userId: string;
  timestamp: string;
  activityType: string;
  duration: number; // minutes
  distance?: number; // meters
  calories?: number;
  heartRate?: {
    average: number;
    min: number;
    max: number;
  };
  metadata: Record<string, unknown>;
}

export interface WearableSleepData {
  provider: IntegrationProvider;
  externalId: string;
  userId: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  quality?: number; // 0-100
  stages?: {
    deep: number;
    light: number;
    rem: number;
    awake: number;
  };
  metadata: Record<string, unknown>;
}

// FHIR Data Types (simplified)
export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  name: Array<{
    given: string[];
    family: string;
  }>;
  birthDate: string;
  gender: string;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: string;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
  };
  effectiveDateTime: string;
  valueQuantity?: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
}

// Calendar Data Types
export interface CalendarEvent {
  provider: IntegrationProvider;
  externalId: string;
  userId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
  metadata: Record<string, unknown>;
}

// Webhook Types
export interface WebhookPayload {
  provider: IntegrationProvider;
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Integration Provider Interface
export interface IntegrationProviderAdapter {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  
  // OAuth flow
  getAuthorizationUrl(redirectUri: string, state: string): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
  revokeAccess(accessToken: string): Promise<void>;
  
  // Data sync
  syncActivities(connection: IntegrationConnection, since?: Date): Promise<WearableActivityData[]>;
  syncSleep(connection: IntegrationConnection, since?: Date): Promise<WearableSleepData[]>;
  
  // Webhook validation
  validateWebhook(payload: unknown, signature: string): boolean;
}

// Validation Schemas
export const IntegrationConnectionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  provider: z.enum([
    'fitbit',
    'apple_health',
    'google_fit',
    'garmin',
    'whoop',
    'oura',
    'epic_fhir',
    'cerner_fhir',
    'google_calendar',
    'outlook_calendar',
  ]),
  category: z.enum(['wearable', 'ehr', 'calendar']),
  status: z.enum(['pending', 'active', 'expired', 'revoked', 'error']),
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.string(),
    scope: z.array(z.string()),
    tokenType: z.string(),
  }),
  metadata: z.record(z.unknown()),
  lastSyncAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SyncJobSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  provider: z.enum([
    'fitbit',
    'apple_health',
    'google_fit',
    'garmin',
    'whoop',
    'oura',
    'epic_fhir',
    'cerner_fhir',
    'google_calendar',
    'outlook_calendar',
  ]),
  dataType: z.string(),
  status: z.enum(['idle', 'syncing', 'success', 'error']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  recordsProcessed: z.number().optional(),
  error: z.string().optional(),
});
