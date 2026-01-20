/**
 * Integration Registry Service
 * 
 * Manages integration connections, OAuth tokens, and sync status.
 * Provides CRUD operations for integrations with proper multi-tenancy.
 */

import { v4 as uuid } from 'uuid';
import { getDataStore } from '@/packages/providers/firebase-datastore';
import { getEventBus } from '@/packages/core/event-bus';
import { DataClassification } from '@/packages/types/multi-tenancy';
import type {
  IntegrationConnection,
  IntegrationProvider,
  IntegrationStatus,
  OAuthTokens,
  SyncJob,
  SyncStatus,
} from './types';

class IntegrationRegistry {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[IntegrationRegistry] Initializing...');
    this.initialized = true;
    console.log('[IntegrationRegistry] Initialized successfully');
  }

  // Connection Management

  async createConnection(
    tenantId: string,
    userId: string,
    provider: IntegrationProvider,
    category: 'wearable' | 'ehr' | 'calendar',
    tokens: OAuthTokens,
    metadata: Record<string, unknown> = {}
  ): Promise<IntegrationConnection> {
    const dataStore = getDataStore();
    const connectionId = uuid();
    
    const connection: IntegrationConnection = {
      id: connectionId,
      tenantId,
      userId,
      provider,
      category,
      status: 'active',
      tokens,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store connection
    await dataStore.set(
      `tenants/${tenantId}/integration_connections`,
      connectionId,
      connection
    );

    // Publish event
    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: uuid(),
      type: 'integration.connected',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: DataClassification.INTERNAL,
      consentScope: 'integrations',
      traceId: uuid(),
      data: {
        connectionId,
        provider,
        category,
      },
    });

    return connection;
  }

  async getConnection(
    connectionId: string,
    tenantId: string,
    userId: string
  ): Promise<IntegrationConnection | null> {
    const dataStore = getDataStore();
    
    const connection = await dataStore.get<IntegrationConnection>(
      `tenants/${tenantId}/integration_connections`,
      connectionId
    );

    if (!connection || connection.userId !== userId) {
      return null;
    }

    return connection;
  }

  async listConnections(
    tenantId: string,
    userId: string,
    options?: {
      provider?: IntegrationProvider;
      category?: 'wearable' | 'ehr' | 'calendar';
      status?: IntegrationStatus;
    }
  ): Promise<IntegrationConnection[]> {
    const dataStore = getDataStore();
    
    const connections = await dataStore.query<IntegrationConnection>(
      `tenants/${tenantId}/integration_connections`,
      [
        { field: 'userId', operator: '==', value: userId },
        ...(options?.provider ? [{ field: 'provider', operator: '==', value: options.provider }] : []),
        ...(options?.category ? [{ field: 'category', operator: '==', value: options.category }] : []),
        ...(options?.status ? [{ field: 'status', operator: '==', value: options.status }] : []),
      ]
    );

    return connections;
  }

  async updateConnectionStatus(
    connectionId: string,
    tenantId: string,
    userId: string,
    status: IntegrationStatus,
    error?: string
  ): Promise<void> {
    const connection = await this.getConnection(connectionId, tenantId, userId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const dataStore = getDataStore();
    
    await dataStore.update(
      `tenants/${tenantId}/integration_connections`,
      connectionId,
      {
        status,
        updatedAt: new Date().toISOString(),
        ...(error && { 'metadata.lastError': error }),
      }
    );

    // Publish event
    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: uuid(),
      type: 'integration.status_changed',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'system', id: 'integration_registry' },
      classification: DataClassification.INTERNAL,
      consentScope: 'integrations',
      traceId: uuid(),
      data: {
        connectionId,
        provider: connection.provider,
        status,
        error,
      },
    });
  }

  async updateTokens(
    connectionId: string,
    tenantId: string,
    userId: string,
    tokens: OAuthTokens
  ): Promise<void> {
    const connection = await this.getConnection(connectionId, tenantId, userId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const dataStore = getDataStore();
    
    await dataStore.update(
      `tenants/${tenantId}/integration_connections`,
      connectionId,
      {
        tokens,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async revokeConnection(
    connectionId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await this.updateConnectionStatus(connectionId, tenantId, userId, 'revoked');

    // Publish event
    const eventBus = getEventBus();
    await eventBus.publish({
      eventId: uuid(),
      type: 'integration.revoked',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: DataClassification.INTERNAL,
      consentScope: 'integrations',
      traceId: uuid(),
      data: {
        connectionId,
      },
    });
  }

  // Sync Job Management

  async createSyncJob(
    connectionId: string,
    tenantId: string,
    userId: string,
    provider: IntegrationProvider,
    dataType: string
  ): Promise<SyncJob> {
    const dataStore = getDataStore();
    const jobId = uuid();
    
    const job: SyncJob = {
      id: jobId,
      connectionId,
      tenantId,
      userId,
      provider,
      dataType,
      status: 'idle',
      startedAt: new Date().toISOString(),
    };

    await dataStore.set(
      `tenants/${tenantId}/sync_jobs`,
      jobId,
      job
    );

    return job;
  }

  async updateSyncJob(
    jobId: string,
    tenantId: string,
    updates: {
      status?: SyncStatus;
      completedAt?: string;
      recordsProcessed?: number;
      error?: string;
    }
  ): Promise<void> {
    const dataStore = getDataStore();
    
    await dataStore.update(
      `tenants/${tenantId}/sync_jobs`,
      jobId,
      updates
    );
  }

  async getSyncJob(
    jobId: string,
    tenantId: string
  ): Promise<SyncJob | null> {
    const dataStore = getDataStore();
    
    return await dataStore.get<SyncJob>(
      `tenants/${tenantId}/sync_jobs`,
      jobId
    );
  }

  async listSyncJobs(
    connectionId: string,
    tenantId: string,
    limit = 50
  ): Promise<SyncJob[]> {
    const dataStore = getDataStore();
    
    const jobs = await dataStore.query<SyncJob>(
      `tenants/${tenantId}/sync_jobs`,
      [{ field: 'connectionId', operator: '==', value: connectionId }],
      { orderBy: 'startedAt', direction: 'desc', limit }
    );

    return jobs;
  }

  async updateLastSync(
    connectionId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    const dataStore = getDataStore();
    
    await dataStore.update(
      `tenants/${tenantId}/integration_connections`,
      connectionId,
      {
        lastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }
}

// Singleton instance
let registryInstance: IntegrationRegistry | null = null;

export function getIntegrationRegistry(): IntegrationRegistry {
  if (!registryInstance) {
    registryInstance = new IntegrationRegistry();
  }
  return registryInstance;
}
