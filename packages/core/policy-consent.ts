/**
 * Policy & Consent OS
 * Phase 1: Policy Decision Point and consent management
 * 
 * Implements:
 * - Policy Decision Point (PDP) for authorization
 * - Consent registry and evaluation
 * - DSR (Data Subject Rights) workflows
 * - Policy evaluation engine
 */

import type { DataStore } from '@/packages/providers/interfaces';
import type { RequestContext, ConsentScope, DataClassification } from '@/packages/types';
import { getDataStore } from '@/packages/providers/firebase-datastore';
import { getSpineService } from './profile-spine';

/**
 * Policy decision result
 */
export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  reasonCodes: string[];
  evaluatedPolicies: string[];
}

/**
 * Policy rule
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  conditions: PolicyCondition[];
  priority: number;
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  type: 'role' | 'consent' | 'entitlement' | 'classification' | 'custom';
  operator: 'equals' | 'contains' | 'in' | 'not_in';
  field: string;
  value: unknown;
}

/**
 * DSR request types
 */
export type DSRType = 'access' | 'export' | 'delete' | 'rectification' | 'restriction' | 'portability';

/**
 * DSR request
 */
export interface DSRRequest {
  id: string;
  type: DSRType;
  userId: string;
  tenantId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  data?: unknown;
  error?: string;
}

/**
 * Policy & Consent Service
 */
export class PolicyConsentService {
  private dataStore: DataStore;
  private policies: Map<string, PolicyRule>;

  constructor(dataStore?: DataStore) {
    this.dataStore = dataStore || getDataStore();
    this.policies = new Map();
    this.loadDefaultPolicies();
  }

  /**
   * Load default policies
   */
  private loadDefaultPolicies(): void {
    // Default policy: Allow if user has consent
    this.policies.set('consent-required', {
      id: 'consent-required',
      name: 'Consent Required',
      description: 'User must have granted consent for the scope',
      effect: 'allow',
      conditions: [
        {
          type: 'consent',
          operator: 'contains',
          field: 'scopes',
          value: 'required_scope',
        },
      ],
      priority: 100,
    });

    // Policy: PHI data requires special entitlement
    this.policies.set('phi-protection', {
      id: 'phi-protection',
      name: 'PHI Data Protection',
      description: 'PHI data requires healthcare professional entitlement',
      effect: 'allow',
      conditions: [
        {
          type: 'entitlement',
          operator: 'contains',
          field: 'features',
          value: 'phi_access',
        },
      ],
      priority: 200,
    });

    // Policy: Deny if in restricted list
    this.policies.set('deny-restricted', {
      id: 'deny-restricted',
      name: 'Deny Restricted Users',
      description: 'Deny access for users in restricted list',
      effect: 'deny',
      conditions: [
        {
          type: 'custom',
          operator: 'in',
          field: 'userId',
          value: [], // Populated dynamically
        },
      ],
      priority: 300,
    });
  }

  /**
   * Evaluate policy decision (PDP)
   */
  async evaluate(
    context: RequestContext,
    resource: string,
    action: string,
    dataClassification?: DataClassification
  ): Promise<PolicyDecision> {
    try {
      const reasonCodes: string[] = [];
      const evaluatedPolicies: string[] = [];
      let allowed = true;
      let primaryReason = 'Default allow';

      // Get user's consent from spine
      const spineService = getSpineService();
      const spine = await spineService.getSnapshot(context.userId, context.tenantId);

      // Sort policies by priority (higher = evaluated first)
      const sortedPolicies = Array.from(this.policies.values())
        .sort((a, b) => b.priority - a.priority);

      for (const policy of sortedPolicies) {
        evaluatedPolicies.push(policy.id);

        // Evaluate conditions
        const conditionsMet = await this.evaluateConditions(
          policy.conditions,
          context,
          spine?.consent.scopes || [],
          dataClassification
        );

        if (conditionsMet) {
          if (policy.effect === 'deny') {
            allowed = false;
            primaryReason = `Denied by policy: ${policy.name}`;
            reasonCodes.push(`DENIED_BY_${policy.id.toUpperCase()}`);
            break; // Deny wins
          } else {
            reasonCodes.push(`ALLOWED_BY_${policy.id.toUpperCase()}`);
          }
        }
      }

      // Log policy decision
      console.log(JSON.stringify({
        event: 'policy.evaluated',
        userId: context.userId,
        tenantId: context.tenantId,
        resource,
        action,
        allowed,
        reasonCodes,
        evaluatedPolicies,
        traceId: context.traceId,
      }));

      return {
        allowed,
        reason: primaryReason,
        reasonCodes,
        evaluatedPolicies,
      };
    } catch (error) {
      // Fail closed - deny on error
      console.error('Policy evaluation error:', error);
      return {
        allowed: false,
        reason: 'Policy evaluation failed',
        reasonCodes: ['EVALUATION_ERROR'],
        evaluatedPolicies: [],
      };
    }
  }

  /**
   * Evaluate policy conditions
   */
  private async evaluateConditions(
    conditions: PolicyCondition[],
    context: RequestContext,
    consentScopes: ConsentScope[],
    dataClassification?: DataClassification
  ): Promise<boolean> {
    for (const condition of conditions) {
      const met = await this.evaluateCondition(
        condition,
        context,
        consentScopes,
        dataClassification
      );
      if (!met) {
        return false; // All conditions must be met
      }
    }
    return true;
  }

  /**
   * Evaluate single condition
   */
  private async evaluateCondition(
    condition: PolicyCondition,
    context: RequestContext,
    consentScopes: ConsentScope[],
    dataClassification?: DataClassification
  ): Promise<boolean> {
    switch (condition.type) {
      case 'role':
        return this.evaluateRoleCondition(condition, context);
      case 'consent':
        return this.evaluateConsentCondition(condition, consentScopes);
      case 'entitlement':
        return this.evaluateEntitlementCondition(condition, context);
      case 'classification':
        return this.evaluateClassificationCondition(condition, dataClassification);
      case 'custom':
        return this.evaluateCustomCondition(condition, context);
      default:
        return false;
    }
  }

  private evaluateRoleCondition(
    condition: PolicyCondition,
    context: RequestContext
  ): boolean {
    const roles = context.roles;
    switch (condition.operator) {
      case 'contains':
        return roles.includes(condition.value as string);
      case 'in':
        return (condition.value as string[]).some(v => roles.includes(v));
      default:
        return false;
    }
  }

  private evaluateConsentCondition(
    condition: PolicyCondition,
    scopes: ConsentScope[]
  ): boolean {
    switch (condition.operator) {
      case 'contains':
        return scopes.includes(condition.value as ConsentScope);
      case 'in':
        return (condition.value as ConsentScope[]).some(v => scopes.includes(v));
      default:
        return false;
    }
  }

  private evaluateEntitlementCondition(
    condition: PolicyCondition,
    context: RequestContext
  ): boolean {
    const entitlements = context.entitlements;
    switch (condition.operator) {
      case 'contains':
        return entitlements.includes(condition.value as string);
      case 'in':
        return (condition.value as string[]).some(v => entitlements.includes(v));
      default:
        return false;
    }
  }

  private evaluateClassificationCondition(
    condition: PolicyCondition,
    classification?: DataClassification
  ): boolean {
    if (!classification) return false;
    
    switch (condition.operator) {
      case 'equals':
        return classification === condition.value;
      case 'in':
        return (condition.value as DataClassification[]).includes(classification);
      default:
        return false;
    }
  }

  private evaluateCustomCondition(
    condition: PolicyCondition,
    context: RequestContext
  ): boolean {
    // Custom evaluation logic
    // For now, just check userId against a list
    if (condition.field === 'userId') {
      const restrictedUsers = condition.value as string[];
      return !restrictedUsers.includes(context.userId);
    }
    return true;
  }

  /**
   * Check if user has consent for specific scope
   */
  async checkConsent(
    userId: string,
    tenantId: string,
    scope: ConsentScope
  ): Promise<boolean> {
    try {
      const spineService = getSpineService();
      const spine = await spineService.getSnapshot(userId, tenantId);
      
      if (!spine) {
        return false;
      }

      // Check if granted and not revoked
      const granted = spine.consent.scopes.includes(scope);
      const revoked = spine.consent.revokedAt && scope in spine.consent.revokedAt;
      
      return granted && !revoked;
    } catch (error) {
      console.error('Consent check error:', error);
      return false;
    }
  }

  /**
   * Create DSR request
   */
  async createDSRRequest(
    type: DSRType,
    userId: string,
    tenantId: string
  ): Promise<DSRRequest> {
    try {
      const request: DSRRequest = {
        id: `dsr_${Date.now()}_${userId}`,
        type,
        userId,
        tenantId,
        status: 'pending',
        requestedAt: new Date(),
      };

      await this.dataStore.create(
        `tenants/${tenantId}/dsr_requests`,
        request.id,
        request
      );

      console.log(JSON.stringify({
        event: 'dsr.created',
        dsrId: request.id,
        type,
        userId,
        tenantId,
      }));

      // Queue for processing
      await this.queueDSRProcessing(request);

      return request;
    } catch (error) {
      throw new Error(`Failed to create DSR request: ${error}`);
    }
  }

  /**
   * Process DSR request
   */
  private async queueDSRProcessing(request: DSRRequest): Promise<void> {
    // In a real implementation, this would queue the request for async processing
    // For now, we'll just log it
    console.log(JSON.stringify({
      event: 'dsr.queued',
      dsrId: request.id,
      type: request.type,
    }));
  }

  /**
   * Get DSR request status
   */
  async getDSRRequest(
    requestId: string,
    tenantId: string
  ): Promise<DSRRequest | null> {
    try {
      return await this.dataStore.get<DSRRequest>(
        `tenants/${tenantId}/dsr_requests`,
        requestId
      );
    } catch (error) {
      console.error('Failed to get DSR request:', error);
      return null;
    }
  }

  /**
   * Add custom policy
   */
  addPolicy(policy: PolicyRule): void {
    this.policies.set(policy.id, policy);
    console.log(JSON.stringify({
      event: 'policy.added',
      policyId: policy.id,
      name: policy.name,
      priority: policy.priority,
    }));
  }

  /**
   * Remove policy
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
    console.log(JSON.stringify({
      event: 'policy.removed',
      policyId,
    }));
  }
}

// Singleton instance
let policyConsentService: PolicyConsentService | null = null;

export function getPolicyConsentService(): PolicyConsentService {
  if (!policyConsentService) {
    policyConsentService = new PolicyConsentService();
  }
  return policyConsentService;
}
