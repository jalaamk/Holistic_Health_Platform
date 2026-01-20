/**
 * Profile Spine - Canonical source of truth for user identity, preferences, and state
 */

import { ConsentScope } from '../events/types';

// Profile Spine Schema
export interface ProfileSpine {
  // Identity
  userId: string;
  tenantId: string;
  version: number; // For optimistic concurrency
  
  // Locale & Timezone
  locale: string;
  timezone: string;
  
  // Preferences
  preferences: UserPreferences;
  
  // Constraints
  constraints: UserConstraints;
  
  // Consent
  consent: ConsentRegistry;
  
  // Computed summaries (with explainability)
  computed: ComputedSummaries;
  
  // Entitlements pointer
  planId: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastComputedAt: Date;
}

// User Preferences
export interface UserPreferences {
  notifications: NotificationPreferences;
  ui: UIPreferences;
  privacy: PrivacyPreferences;
  coaching: CoachingPreferences;
}

export interface NotificationPreferences {
  enabled: boolean;
  quietHoursStart?: string; // HH:mm
  quietHoursEnd?: string; // HH:mm
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  categories: Record<string, boolean>;
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  units: {
    distance: 'km' | 'miles';
    weight: 'kg' | 'lbs';
    temperature: 'celsius' | 'fahrenheit';
  };
  firstDayOfWeek: number; // 0-6, Sunday=0
}

export interface PrivacyPreferences {
  profileVisibility: 'public' | 'friends' | 'private';
  shareProgress: boolean;
  shareLocation: boolean;
}

export interface CoachingPreferences {
  style: 'encouraging' | 'direct' | 'minimal';
  frequency: 'high' | 'medium' | 'low';
  focusAreas: string[];
}

// User Constraints
export interface UserConstraints {
  // Nutrition
  dietaryRestrictions?: string[];
  allergies?: string[];
  calorieTarget?: number;
  
  // Movement
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  injuries?: string[];
  equipmentAvailable?: string[];
  
  // Sleep
  targetSleepHours?: number;
  bedtimeGoal?: string; // HH:mm
  wakeTimeGoal?: string; // HH:mm
  
  // General
  medicalConditions?: string[];
  medications?: string[];
}

// Consent Registry
export interface ConsentRegistry {
  scopes: Record<ConsentScope, ConsentRecord>;
  professionalAccess?: ProfessionalAccessGrant[];
  dataSharing?: DataSharingGrant[];
}

export interface ConsentRecord {
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  expiresAt?: Date;
  version: string;
  provenance: string; // How consent was obtained
}

export interface ProfessionalAccessGrant {
  proUserId: string;
  proDisplayName: string;
  scopes: ConsentScope[];
  grantedAt: Date;
  expiresAt?: Date;
  revoked: boolean;
}

export interface DataSharingGrant {
  purpose: string;
  scopes: ConsentScope[];
  grantedAt: Date;
  expiresAt?: Date;
  revoked: boolean;
}

// Computed Summaries (with explainability)
export interface ComputedSummaries {
  adherence?: AdherenceScore;
  wellness?: WellnessScore;
  riskFlags?: RiskFlag[];
  insights?: Insight[];
}

export interface AdherenceScore {
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  confidence: number; // 0-1
  reasonCodes: string[];
  evidence: EvidencePack;
  computedAt: Date;
}

export interface WellnessScore {
  overall: number; // 0-100
  dimensions: Record<string, number>;
  confidence: number;
  reasonCodes: string[];
  evidence: EvidencePack;
  computedAt: Date;
}

export interface RiskFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  reasonCodes: string[];
  detectedAt: Date;
}

export interface Insight {
  id: string;
  category: string;
  message: string;
  actionable: boolean;
  suggestedAction?: string;
  confidence: number;
  evidence: EvidencePack;
  createdAt: Date;
}

export interface EvidencePack {
  dataPoints: DataPoint[];
  sources: string[];
  timeRange: { start: Date; end: Date };
}

export interface DataPoint {
  metric: string;
  value: number;
  timestamp: Date;
  source: string;
}

// Patch operations for updating spine
export type PatchOperation = 
  | { op: 'set'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'add'; path: string; value: unknown }
  | { op: 'merge'; path: string; value: Record<string, unknown> };

export interface PatchRequest {
  userId: string;
  tenantId: string;
  version: number; // For optimistic concurrency
  operations: PatchOperation[];
  reason?: string;
}

export interface PatchResult {
  success: boolean;
  newVersion: number;
  appliedOperations: number;
  errors?: PatchError[];
}

export interface PatchError {
  operation: PatchOperation;
  code: string;
  message: string;
}
