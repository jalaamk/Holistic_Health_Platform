/**
 * Profile Spine OS
 * Phase 1: Canonical user profile with versioning
 * 
 * Implements:
 * - Snapshot API (GET)
 * - Patch operations with optimistic concurrency
 * - Computed views with explainability
 * - Event publishing on changes
 */

import type { ProfileSpine } from '@/packages/types';
import type { DataStore } from '@/packages/providers/interfaces';
import { getDataStore } from '@/packages/providers/firebase-datastore';
import { getEventBus } from './event-bus';
import { randomUUID } from 'crypto';

/**
 * Patch operation for Profile Spine
 */
export interface SpinePatchOperation {
  op: 'add' | 'remove' | 'replace' | 'test';
  path: string; // e.g., '/preferences/theme' or '/consent/scopes/0'
  value?: unknown;
}

/**
 * Patch request
 */
export interface SpinePatchRequest {
  userId: string;
  tenantId: string;
  version: number; // For optimistic concurrency
  operations: SpinePatchOperation[];
  reason?: string; // Audit trail
}

/**
 * Patch result
 */
export interface SpinePatchResult {
  success: boolean;
  version: number;
  spine?: ProfileSpine;
  error?: {
    code: string;
    message: string;
    conflictVersion?: number;
  };
}

/**
 * Profile Spine Service
 */
export class ProfileSpineService {
  private dataStore: DataStore;

  constructor(dataStore?: DataStore) {
    this.dataStore = dataStore || getDataStore();
  }

  /**
   * Get snapshot of profile spine
   */
  async getSnapshot(userId: string, tenantId: string): Promise<ProfileSpine | null> {
    try {
      const spine = await this.dataStore.get<ProfileSpine>(
        `tenants/${tenantId}/spines`,
        userId
      );

      if (!spine) {
        return null;
      }

      // Log access for audit
      console.log(JSON.stringify({
        event: 'spine.snapshot_accessed',
        userId,
        tenantId,
        version: spine.version,
      }));

      return spine;
    } catch (error) {
      throw new Error(`Failed to get spine snapshot: ${error}`);
    }
  }

  /**
   * Create initial spine for new user
   */
  async createSpine(
    userId: string,
    tenantId: string,
    initialData?: Partial<ProfileSpine>
  ): Promise<ProfileSpine> {
    try {
      const spine: ProfileSpine = {
        userId,
        tenantId,
        version: 1,
        identity: {
          displayName: initialData?.identity?.displayName,
          locale: initialData?.identity?.locale || 'en-US',
          timezone: initialData?.identity?.timezone || 'UTC',
        },
        preferences: initialData?.preferences || {},
        constraints: initialData?.constraints || {},
        consent: {
          scopes: initialData?.consent?.scopes || [],
          grantedAt: {},
          revokedAt: {},
        },
        policyRefs: initialData?.policyRefs || [],
        entitlements: {
          plan: 'consumer',
          limits: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.dataStore.create(
        `tenants/${tenantId}/spines`,
        userId,
        spine
      );

      // Publish spine.created event
      const eventBus = getEventBus();
      await eventBus.publish({
        eventId: randomUUID(),
        type: 'spine.created',
        occurredAt: new Date().toISOString(),
        tenantId,
        userId,
        actor: { type: 'system', id: 'spine-service' },
        classification: 'internal',
        traceId: randomUUID(),
        data: { version: spine.version },
      });

      console.log(JSON.stringify({
        event: 'spine.created',
        userId,
        tenantId,
        version: 1,
      }));

      return spine;
    } catch (error) {
      throw new Error(`Failed to create spine: ${error}`);
    }
  }

  /**
   * Apply patch operations to spine with optimistic concurrency
   */
  async applyPatch(request: SpinePatchRequest): Promise<SpinePatchResult> {
    try {
      // Use transaction for atomicity
      return await this.dataStore.runTransaction(async (transaction) => {
        // Get current spine
        const currentSpine = await transaction.get<ProfileSpine>(
          `tenants/${request.tenantId}/spines`,
          request.userId
        );

        if (!currentSpine) {
          return {
            success: false,
            version: 0,
            error: {
              code: 'SPINE_NOT_FOUND',
              message: 'Profile spine not found',
            },
          };
        }

        // Check version for optimistic concurrency
        if (currentSpine.version !== request.version) {
          return {
            success: false,
            version: currentSpine.version,
            error: {
              code: 'VERSION_CONFLICT',
              message: `Version mismatch: expected ${request.version}, got ${currentSpine.version}`,
              conflictVersion: currentSpine.version,
            },
          };
        }

        // Apply patches
        const updatedSpine = this.applyPatches(
          currentSpine,
          request.operations
        );

        // Increment version
        updatedSpine.version += 1;
        updatedSpine.updatedAt = new Date();

        // Update in transaction
        transaction.update(
          `tenants/${request.tenantId}/spines`,
          request.userId,
          updatedSpine
        );

        return {
          success: true,
          version: updatedSpine.version,
          spine: updatedSpine,
        };
      });
    } catch (error) {
      return {
        success: false,
        version: 0,
        error: {
          code: 'PATCH_FAILED',
          message: `Failed to apply patch: ${error}`,
        },
      };
    } finally {
      // Publish spine.patched event (outside transaction)
      if (request.operations.length > 0) {
        try {
          const eventBus = getEventBus();
          await eventBus.publish({
            eventId: randomUUID(),
            type: 'spine.patched',
            occurredAt: new Date().toISOString(),
            tenantId: request.tenantId,
            userId: request.userId,
            actor: { type: 'user', id: request.userId },
            classification: 'internal',
            traceId: randomUUID(),
            data: {
              operations: request.operations,
              reason: request.reason,
            },
          });
        } catch (eventError) {
          console.error('Failed to publish spine.patched event:', eventError);
        }
      }
    }
  }

  /**
   * Apply JSON Patch operations to spine
   */
  private applyPatches(
    spine: ProfileSpine,
    operations: SpinePatchOperation[]
  ): ProfileSpine {
    const updated = JSON.parse(JSON.stringify(spine)) as ProfileSpine;

    for (const op of operations) {
      this.applyPatchOperation(updated, op);
    }

    return updated;
  }

  /**
   * Apply single patch operation
   */
  private applyPatchOperation(
    spine: ProfileSpine,
    op: SpinePatchOperation
  ): void {
    const pathParts = op.path.split('/').filter(p => p.length > 0);
    
    if (pathParts.length === 0) {
      throw new Error('Invalid patch path');
    }

    let target: Record<string, unknown> = spine as unknown as Record<string, unknown>;
    const lastPart = pathParts[pathParts.length - 1];
    
    // Navigate to parent
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!(part in target)) {
        if (op.op === 'add') {
          target[part] = {};
        } else {
          throw new Error(`Path not found: ${op.path}`);
        }
      }
      target = target[part] as Record<string, unknown>;
    }

    // Apply operation
    switch (op.op) {
      case 'add':
      case 'replace':
        target[lastPart] = op.value;
        break;
      case 'remove':
        delete target[lastPart];
        break;
      case 'test':
        if (JSON.stringify(target[lastPart]) !== JSON.stringify(op.value)) {
          throw new Error(`Test failed at ${op.path}`);
        }
        break;
      default:
        throw new Error(`Unknown operation: ${op.op}`);
    }
  }

  /**
   * Update computed views (scores, risk flags, etc.)
   */
  async updateComputedViews(
    userId: string,
    tenantId: string,
    computed: ProfileSpine['computed']
  ): Promise<SpinePatchResult> {
    const operations: SpinePatchOperation[] = [
      {
        op: 'replace',
        path: '/computed',
        value: computed,
      },
    ];

    // Get current version
    const current = await this.getSnapshot(userId, tenantId);
    if (!current) {
      return {
        success: false,
        version: 0,
        error: {
          code: 'SPINE_NOT_FOUND',
          message: 'Profile spine not found',
        },
      };
    }

    return this.applyPatch({
      userId,
      tenantId,
      version: current.version,
      operations,
      reason: 'Computed views updated',
    });
  }

  /**
   * Grant consent scope
   */
  async grantConsent(
    userId: string,
    tenantId: string,
    scope: string
  ): Promise<SpinePatchResult> {
    const current = await this.getSnapshot(userId, tenantId);
    if (!current) {
      return {
        success: false,
        version: 0,
        error: {
          code: 'SPINE_NOT_FOUND',
          message: 'Profile spine not found',
        },
      };
    }

    const operations: SpinePatchOperation[] = [
      {
        op: 'add',
        path: `/consent/grantedAt/${scope}`,
        value: new Date().toISOString(),
      },
    ];

    // Add to scopes array if not present
    if (!current.consent.scopes.includes(scope as never)) {
      operations.push({
        op: 'add',
        path: '/consent/scopes/-',
        value: scope,
      });
    }

    return this.applyPatch({
      userId,
      tenantId,
      version: current.version,
      operations,
      reason: `Granted consent for ${scope}`,
    });
  }

  /**
   * Revoke consent scope
   */
  async revokeConsent(
    userId: string,
    tenantId: string,
    scope: string
  ): Promise<SpinePatchResult> {
    const current = await this.getSnapshot(userId, tenantId);
    if (!current) {
      return {
        success: false,
        version: 0,
        error: {
          code: 'SPINE_NOT_FOUND',
          message: 'Profile spine not found',
        },
      };
    }

    const operations: SpinePatchOperation[] = [
      {
        op: 'add',
        path: `/consent/revokedAt/${scope}`,
        value: new Date().toISOString(),
      },
    ];

    return this.applyPatch({
      userId,
      tenantId,
      version: current.version,
      operations,
      reason: `Revoked consent for ${scope}`,
    });
  }
}

// Singleton instance
let spineService: ProfileSpineService | null = null;

export function getSpineService(): ProfileSpineService {
  if (!spineService) {
    spineService = new ProfileSpineService();
  }
  return spineService;
}
