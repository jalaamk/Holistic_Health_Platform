/**
 * Entitlements Service
 * Phase 0: Feature gating and quota management
 * 
 * Checks whether a user/tenant has access to features and has quota remaining.
 * Used by BFF and AI Orchestrator for authorization.
 */

import type { EntitlementCheckResult } from '@/packages/types';
import type { DataStore } from '@/packages/providers/interfaces';
import { getDataStore } from '@/packages/providers/firebase-datastore';

// Constant for unlimited quota
export const UNLIMITED_QUOTA = Number.POSITIVE_INFINITY;

export interface EntitlementConfig {
  tenantId: string;
  plan: string;
  features: string[];
  quotas: Record<string, number>; // e.g., { aiRequests: 1000, storage: 10000 }
  usage: Record<string, number>;
}

export class EntitlementsService {
  private dataStore: DataStore;

  constructor(dataStore?: DataStore) {
    this.dataStore = dataStore || getDataStore();
  }

  /**
   * Check if a feature is enabled for this tenant
   */
  async checkFeature(
    tenantId: string,
    feature: string
  ): Promise<EntitlementCheckResult> {
    try {
      const entitlements = await this.getEntitlements(tenantId);
      
      if (!entitlements) {
        return {
          allowed: false,
          reason: 'Tenant not found',
        };
      }

      const hasFeature = entitlements.features.includes(feature);
      
      return {
        allowed: hasFeature,
        reason: hasFeature ? undefined : `Feature '${feature}' not available on plan '${entitlements.plan}'`,
      };
    } catch (error) {
      throw new Error(`Failed to check feature entitlement: ${error}`);
    }
  }

  /**
   * Check if tenant has quota remaining for a resource
   */
  async checkQuota(
    tenantId: string,
    resource: string,
    amount: number = 1
  ): Promise<EntitlementCheckResult> {
    try {
      const entitlements = await this.getEntitlements(tenantId);
      
      if (!entitlements) {
        return {
          allowed: false,
          reason: 'Tenant not found',
        };
      }

      const quota = entitlements.quotas[resource];
      const usage = entitlements.usage[resource] || 0;
      
      if (quota === undefined) {
        // No quota defined = unlimited
        return {
          allowed: true,
        };
      }

      const remaining = quota - usage;
      const allowed = remaining >= amount;
      
      return {
        allowed,
        quotaRemaining: remaining,
        reason: allowed ? undefined : `Quota exceeded for '${resource}' (used: ${usage}, limit: ${quota})`,
      };
    } catch (error) {
      throw new Error(`Failed to check quota: ${error}`);
    }
  }

  /**
   * Increment usage for a quota
   */
  async incrementUsage(
    tenantId: string,
    resource: string,
    amount: number = 1
  ): Promise<void> {
    try {
      const entitlements = await this.getEntitlements(tenantId);
      
      if (!entitlements) {
        throw new Error('Tenant not found');
      }

      const currentUsage = entitlements.usage[resource] || 0;
      entitlements.usage[resource] = currentUsage + amount;
      
      await this.dataStore.update('entitlements', tenantId, {
        usage: entitlements.usage,
      });

      // Log telemetry
      console.log(JSON.stringify({
        event: 'entitlements.usage_incremented',
        tenantId,
        resource,
        amount,
        newUsage: entitlements.usage[resource],
      }));
    } catch (error) {
      throw new Error(`Failed to increment usage: ${error}`);
    }
  }

  /**
   * Get entitlements for a tenant
   */
  private async getEntitlements(tenantId: string): Promise<EntitlementConfig | null> {
    try {
      return await this.dataStore.get<EntitlementConfig>('entitlements', tenantId);
    } catch (error) {
      throw new Error(`Failed to get entitlements: ${error}`);
    }
  }

  /**
   * Create default entitlements for a new tenant
   */
  async createDefaultEntitlements(
    tenantId: string,
    plan: string = 'consumer'
  ): Promise<EntitlementConfig> {
    const defaults = this.getDefaultsByPlan(plan);
    
    const entitlements: EntitlementConfig = {
      tenantId,
      plan,
      features: defaults.features,
      quotas: defaults.quotas,
      usage: {},
    };

    await this.dataStore.create('entitlements', tenantId, entitlements);
    
    return entitlements;
  }

  /**
   * Get default entitlements by plan
   */
  private getDefaultsByPlan(plan: string): {
    features: string[];
    quotas: Record<string, number>;
  } {
    switch (plan) {
      case 'consumer':
        return {
          features: [
            'nutrition',
            'movement',
            'sleep',
            'habits',
            'mind',
            'ai_insights_basic',
          ],
          quotas: {
            aiRequests: 100, // per month
            storage: 10000, // MB
          },
        };
      
      case 'pro':
        return {
          features: [
            'nutrition',
            'movement',
            'sleep',
            'habits',
            'mind',
            'ai_insights_advanced',
            'professional_suite',
            'client_management',
          ],
          quotas: {
            aiRequests: 1000,
            storage: 100000,
            clients: 50,
          },
        };
      
      case 'enterprise':
        return {
          features: [
            'nutrition',
            'movement',
            'sleep',
            'habits',
            'mind',
            'ai_insights_advanced',
            'professional_suite',
            'client_management',
            'sso',
            'scim',
            'audit_logs',
            'custom_retention',
          ],
          quotas: {
            aiRequests: UNLIMITED_QUOTA,
            storage: UNLIMITED_QUOTA,
            clients: UNLIMITED_QUOTA,
          },
        };
      
      default:
        throw new Error(`Unknown plan: ${plan}`);
    }
  }
}

// Singleton instance
let entitlementsService: EntitlementsService | null = null;

export function getEntitlementsService(): EntitlementsService {
  if (!entitlementsService) {
    entitlementsService = new EntitlementsService();
  }
  return entitlementsService;
}
