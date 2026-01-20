/**
 * Tests for Entitlements Service
 */

import { EntitlementsService } from '../services/entitlements';
import { Entitlements, TenantTier } from '../models/types';

describe('EntitlementsService', () => {
  let service: EntitlementsService;

  beforeEach(() => {
    service = new EntitlementsService();
  });

  describe('hasFeature', () => {
    it('should return true when feature is enabled', () => {
      const entitlements: Entitlements = {
        features: { testFeature: true },
        quotas: {},
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(service.hasFeature(entitlements, 'testFeature')).toBe(true);
    });

    it('should return false when feature is disabled', () => {
      const entitlements: Entitlements = {
        features: { testFeature: false },
        quotas: {},
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(service.hasFeature(entitlements, 'testFeature')).toBe(false);
    });

    it('should return false when feature does not exist', () => {
      const entitlements: Entitlements = {
        features: {},
        quotas: {},
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(service.hasFeature(entitlements, 'testFeature')).toBe(false);
    });
  });

  describe('hasQuotaCapacity', () => {
    it('should return true when quota has capacity', () => {
      const entitlements: Entitlements = {
        features: {},
        quotas: {
          testQuota: {
            limit: 100,
            used: 50,
            resetAt: new Date(),
          },
        },
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(service.hasQuotaCapacity(entitlements, 'testQuota', 10)).toBe(true);
    });

    it('should return false when quota is exhausted', () => {
      const entitlements: Entitlements = {
        features: {},
        quotas: {
          testQuota: {
            limit: 100,
            used: 100,
            resetAt: new Date(),
          },
        },
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(service.hasQuotaCapacity(entitlements, 'testQuota', 1)).toBe(false);
    });

    it('should return false when quota does not exist', () => {
      const entitlements: Entitlements = {
        features: {},
        quotas: {},
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(service.hasQuotaCapacity(entitlements, 'testQuota', 1)).toBe(false);
    });
  });

  describe('getEntitlementsForTier', () => {
    it('should return consumer entitlements for consumer tier', () => {
      const entitlements = service.getEntitlementsForTier('consumer' as TenantTier);

      expect(entitlements.features.habits).toBe(true);
      expect(entitlements.features.ai_insights).toBe(false);
      expect(entitlements.aiEnabled).toBe(false);
    });

    it('should return pro entitlements for pro tier', () => {
      const entitlements = service.getEntitlementsForTier('pro' as TenantTier);

      expect(entitlements.features.habits).toBe(true);
      expect(entitlements.features.ai_insights).toBe(true);
      expect(entitlements.aiEnabled).toBe(true);
      expect(entitlements.features.client_management).toBe(true);
    });

    it('should return enterprise entitlements for enterprise tier', () => {
      const entitlements = service.getEntitlementsForTier('enterprise' as TenantTier);

      expect(entitlements.features.habits).toBe(true);
      expect(entitlements.features.ai_insights).toBe(true);
      expect(entitlements.features.sso).toBe(true);
      expect(entitlements.features.api_access).toBe(true);
      expect(entitlements.aiEnabled).toBe(true);
    });
  });

  describe('consumeQuota', () => {
    it('should consume quota successfully', () => {
      const entitlements: Entitlements = {
        features: {},
        quotas: {
          testQuota: {
            limit: 100,
            used: 50,
            resetAt: new Date(),
          },
        },
        aiEnabled: false,
        integrationsEnabled: false,
      };

      const result = service.consumeQuota(entitlements, 'testQuota', 10);

      expect(result.quotas.testQuota.used).toBe(60);
    });

    it('should throw error when quota is exhausted', () => {
      const entitlements: Entitlements = {
        features: {},
        quotas: {
          testQuota: {
            limit: 100,
            used: 100,
            resetAt: new Date(),
          },
        },
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(() => {
        service.consumeQuota(entitlements, 'testQuota', 1);
      }).toThrow('Insufficient quota');
    });

    it('should throw error when quota does not exist', () => {
      const entitlements: Entitlements = {
        features: {},
        quotas: {},
        aiEnabled: false,
        integrationsEnabled: false,
      };

      expect(() => {
        service.consumeQuota(entitlements, 'testQuota', 1);
      }).toThrow('Quota testQuota not found');
    });
  });
});
