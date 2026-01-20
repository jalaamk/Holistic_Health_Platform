/**
 * Entitlements Service
 * Feature gating and quota management
 */

import { Entitlements, TenantTier, RequestContext } from '../models/types';

export class EntitlementsService {
  /**
   * Check if a feature is enabled for the given entitlements
   */
  hasFeature(entitlements: Entitlements, featureName: string): boolean {
    return entitlements.features[featureName] === true;
  }

  /**
   * Check if a quota has capacity remaining
   */
  hasQuotaCapacity(entitlements: Entitlements, quotaName: string, required: number = 1): boolean {
    const quota = entitlements.quotas[quotaName];
    if (!quota) {
      return false;
    }
    return (quota.limit - quota.used) >= required;
  }

  /**
   * Consume quota
   */
  consumeQuota(entitlements: Entitlements, quotaName: string, amount: number = 1): Entitlements {
    const quota = entitlements.quotas[quotaName];
    if (!quota) {
      throw new Error(`Quota ${quotaName} not found`);
    }
    
    if (!this.hasQuotaCapacity(entitlements, quotaName, amount)) {
      throw new Error(`Insufficient quota for ${quotaName}. Required: ${amount}, Available: ${quota.limit - quota.used}`);
    }

    return {
      ...entitlements,
      quotas: {
        ...entitlements.quotas,
        [quotaName]: {
          ...quota,
          used: quota.used + amount,
        },
      },
    };
  }

  /**
   * Get entitlements for a tenant tier
   */
  getEntitlementsForTier(tier: TenantTier): Entitlements {
    switch (tier) {
      case 'consumer':
        return {
          features: {
            habits: true,
            nutrition: true,
            sleep: true,
            movement: true,
            journal: true,
            timeline: true,
            rewards: true,
            notifications: true,
            ai_insights: false,
            integrations: false,
            professional_access: false,
            advanced_analytics: false,
            export_data: true,
          },
          quotas: {
            daily_logs: {
              limit: 50,
              used: 0,
              resetAt: this.getNextDayReset(),
            },
            ai_requests: {
              limit: 0,
              used: 0,
              resetAt: this.getNextMonthReset(),
            },
          },
          aiEnabled: false,
          integrationsEnabled: false,
        };

      case 'pro':
        return {
          features: {
            habits: true,
            nutrition: true,
            sleep: true,
            movement: true,
            journal: true,
            timeline: true,
            rewards: true,
            notifications: true,
            ai_insights: true,
            integrations: true,
            professional_access: true,
            advanced_analytics: true,
            export_data: true,
            client_management: true,
            program_builder: true,
          },
          quotas: {
            daily_logs: {
              limit: 500,
              used: 0,
              resetAt: this.getNextDayReset(),
            },
            ai_requests: {
              limit: 1000,
              used: 0,
              resetAt: this.getNextMonthReset(),
            },
            clients: {
              limit: 50,
              used: 0,
              resetAt: new Date('2099-12-31'), // No auto-reset
            },
          },
          aiEnabled: true,
          aiMonthlyTokenLimit: 100000,
          integrationsEnabled: true,
          maxIntegrations: 10,
        };

      case 'enterprise':
        return {
          features: {
            habits: true,
            nutrition: true,
            sleep: true,
            movement: true,
            journal: true,
            timeline: true,
            rewards: true,
            notifications: true,
            ai_insights: true,
            integrations: true,
            professional_access: true,
            advanced_analytics: true,
            export_data: true,
            client_management: true,
            program_builder: true,
            sso: true,
            scim: true,
            audit_logs: true,
            custom_branding: true,
            api_access: true,
            dedicated_support: true,
          },
          quotas: {
            daily_logs: {
              limit: 10000,
              used: 0,
              resetAt: this.getNextDayReset(),
            },
            ai_requests: {
              limit: 100000,
              used: 0,
              resetAt: this.getNextMonthReset(),
            },
            clients: {
              limit: 10000,
              used: 0,
              resetAt: new Date('2099-12-31'),
            },
          },
          aiEnabled: true,
          aiMonthlyTokenLimit: 10000000,
          integrationsEnabled: true,
        };

      default:
        throw new Error(`Unknown tenant tier: ${tier}`);
    }
  }

  /**
   * Enforce feature gate - throws if not allowed
   */
  enforceFeature(context: RequestContext, featureName: string): void {
    if (!this.hasFeature(context.entitlements, featureName)) {
      throw new EntitlementError(
        'FEATURE_NOT_ENABLED',
        `Feature ${featureName} is not enabled for this tenant`,
        { featureName, tenantId: context.tenantId }
      );
    }
  }

  /**
   * Enforce quota - throws if insufficient
   */
  enforceQuota(context: RequestContext, quotaName: string, required: number = 1): void {
    if (!this.hasQuotaCapacity(context.entitlements, quotaName, required)) {
      const quota = context.entitlements.quotas[quotaName];
      throw new EntitlementError(
        'QUOTA_EXCEEDED',
        `Insufficient quota for ${quotaName}`,
        { 
          quotaName, 
          required, 
          available: quota ? quota.limit - quota.used : 0,
          resetAt: quota?.resetAt,
        }
      );
    }
  }

  private getNextDayReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getNextMonthReset(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }
}

export class EntitlementError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EntitlementError';
  }
}

// Singleton instance
export const entitlementsService = new EntitlementsService();
