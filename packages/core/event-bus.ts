/**
 * Event Bus Implementation
 * Phase 1: Core event-driven architecture
 * 
 * Implements:
 * - Outbox pattern for reliable event publishing
 * - Idempotency store for deduplication
 * - Event handlers and subscribers
 * - Dead-letter queue for poison events
 */

import type { 
  EventBus, 
  EventEnvelope, 
  Subscription, 
  SubscriptionOptions,
  DataStore 
} from '@/packages/providers/interfaces';
import { getDataStore } from '@/packages/providers/firebase-datastore';
import { randomUUID } from 'crypto';

/**
 * Event metadata for tracking
 */
interface EventMetadata {
  eventId: string;
  type: string;
  occurredAt: string;
  publishedAt?: string;
  processedAt?: string;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'published' | 'processed' | 'failed' | 'dlq';
}

/**
 * Outbox entry for reliable publishing
 */
interface OutboxEntry<T = unknown> {
  id: string;
  event: EventEnvelope<T>;
  metadata: EventMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Idempotency record
 */
interface IdempotencyRecord {
  eventId: string;
  processedAt: string;
  processedBy: string;
}

/**
 * Event handler function
 */
type EventHandler<T = unknown> = (event: EventEnvelope<T>) => Promise<void>;

/**
 * Subscription registry entry
 */
interface SubscriptionEntry {
  id: string;
  eventType: string;
  handler: EventHandler;
  options: SubscriptionOptions;
}

/**
 * Event Bus implementation with outbox pattern
 */
export class EventBusImpl implements EventBus {
  private dataStore: DataStore;
  private subscriptions: Map<string, SubscriptionEntry[]>;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly PROCESSING_INTERVAL_MS = 5000; // 5 seconds

  constructor(dataStore?: DataStore) {
    this.dataStore = dataStore || getDataStore();
    this.subscriptions = new Map();
  }

  /**
   * Publish event using outbox pattern
   * Writes to outbox atomically with domain operation
   */
  async publish<T>(event: EventEnvelope<T>): Promise<void> {
    try {
      const outboxEntry: OutboxEntry<T> = {
        id: randomUUID(),
        event,
        metadata: {
          eventId: event.eventId,
          type: event.type,
          occurredAt: event.occurredAt,
          attempts: 0,
          status: 'pending',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Write to outbox collection
      await this.dataStore.create(
        'event_outbox',
        outboxEntry.id,
        outboxEntry
      );

      // Log telemetry
      console.log(JSON.stringify({
        event: 'eventbus.published',
        eventId: event.eventId,
        eventType: event.type,
        tenantId: event.tenantId,
        userId: event.userId,
        traceId: event.traceId,
      }));

      // Trigger immediate processing (best effort)
      this.processOutbox().catch(err => {
        console.error('Failed to process outbox immediately:', err);
      });
    } catch (error) {
      throw new Error(`Failed to publish event: ${error}`);
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Subscription {
    const subscriptionId = randomUUID();
    const entry: SubscriptionEntry = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      options: options || {},
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }
    this.subscriptions.get(eventType)!.push(entry);

    console.log(JSON.stringify({
      event: 'eventbus.subscribed',
      subscriptionId,
      eventType,
    }));

    return {
      id: subscriptionId,
      eventType,
    };
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscription: Subscription): Promise<void> {
    const entries = this.subscriptions.get(subscription.eventType);
    if (entries) {
      const filtered = entries.filter(e => e.id !== subscription.id);
      if (filtered.length === 0) {
        this.subscriptions.delete(subscription.eventType);
      } else {
        this.subscriptions.set(subscription.eventType, filtered);
      }
    }

    console.log(JSON.stringify({
      event: 'eventbus.unsubscribed',
      subscriptionId: subscription.id,
      eventType: subscription.eventType,
    }));
  }

  /**
   * Start processing outbox entries
   */
  startProcessing(): void {
    if (this.processingInterval) {
      return; // Already started
    }

    this.processingInterval = setInterval(() => {
      this.processOutbox().catch(err => {
        console.error('Outbox processing error:', err);
      });
    }, this.PROCESSING_INTERVAL_MS);

    console.log('Event bus processing started');
  }

  /**
   * Stop processing outbox entries
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Event bus processing stopped');
    }
  }

  /**
   * Process pending outbox entries
   */
  private async processOutbox(): Promise<void> {
    try {
      // Get pending entries
      const pendingEntries = await this.dataStore.query<OutboxEntry>(
        'event_outbox',
        [{ field: 'metadata.status', operator: '==', value: 'pending' }]
      );

      for (const entry of pendingEntries) {
        await this.processOutboxEntry(entry);
      }
    } catch (error) {
      console.error('Failed to process outbox:', error);
    }
  }

  /**
   * Process a single outbox entry
   */
  private async processOutboxEntry(entry: OutboxEntry): Promise<void> {
    try {
      // Check idempotency
      const alreadyProcessed = await this.checkIdempotency(entry.event.eventId);
      if (alreadyProcessed) {
        // Mark as processed and skip
        await this.updateOutboxStatus(entry.id, 'processed');
        return;
      }

      // Get subscribers for this event type
      const subscribers = this.subscriptions.get(entry.event.type) || [];

      // Publish to all subscribers
      for (const subscriber of subscribers) {
        try {
          await subscriber.handler(entry.event);
          
          // Record idempotency
          await this.recordIdempotency(
            entry.event.eventId,
            subscriber.id
          );
        } catch (error) {
          console.error(
            `Subscriber ${subscriber.id} failed to process event ${entry.event.eventId}:`,
            error
          );
          
          // Increment attempts
          const newAttempts = entry.metadata.attempts + 1;
          
          if (newAttempts >= this.MAX_RETRIES) {
            // Move to DLQ
            await this.moveToDLQ(entry, error as Error);
          } else {
            // Update for retry
            await this.dataStore.update('event_outbox', entry.id, {
              'metadata.attempts': newAttempts,
              'metadata.lastError': (error as Error).message,
              'metadata.status': 'pending',
            });
          }
          
          throw error; // Propagate to stop processing this entry
        }
      }

      // Mark as published
      await this.updateOutboxStatus(entry.id, 'published');

      console.log(JSON.stringify({
        event: 'eventbus.processed',
        eventId: entry.event.eventId,
        eventType: entry.event.type,
        subscriberCount: subscribers.length,
      }));
    } catch (error) {
      console.error(`Failed to process outbox entry ${entry.id}:`, error);
    }
  }

  /**
   * Check if event was already processed (idempotency)
   */
  private async checkIdempotency(eventId: string): Promise<boolean> {
    try {
      const record = await this.dataStore.get<IdempotencyRecord>(
        'event_idempotency',
        eventId
      );
      return record !== null;
    } catch {
      return false;
    }
  }

  /**
   * Record event processing for idempotency
   */
  private async recordIdempotency(
    eventId: string,
    processedBy: string
  ): Promise<void> {
    const record: IdempotencyRecord = {
      eventId,
      processedAt: new Date().toISOString(),
      processedBy,
    };

    await this.dataStore.create('event_idempotency', eventId, record);
  }

  /**
   * Update outbox entry status
   */
  private async updateOutboxStatus(
    entryId: string,
    status: EventMetadata['status']
  ): Promise<void> {
    await this.dataStore.update('event_outbox', entryId, {
      'metadata.status': status,
      'metadata.processedAt': new Date().toISOString(),
    });
  }

  /**
   * Move failed event to dead-letter queue
   */
  private async moveToDLQ(entry: OutboxEntry, error: Error): Promise<void> {
    try {
      const dlqEntry = {
        ...entry,
        metadata: {
          ...entry.metadata,
          status: 'dlq' as const,
          lastError: error.message,
        },
        movedToDLQAt: new Date(),
      };

      await this.dataStore.create('event_dlq', entry.id, dlqEntry);
      await this.updateOutboxStatus(entry.id, 'failed');

      console.log(JSON.stringify({
        event: 'eventbus.moved_to_dlq',
        eventId: entry.event.eventId,
        eventType: entry.event.type,
        attempts: entry.metadata.attempts,
        error: error.message,
      }));
    } catch (dlqError) {
      console.error('Failed to move event to DLQ:', dlqError);
    }
  }

  /**
   * Replay events from a specific time
   */
  async replay(fromTime: Date, eventType?: string): Promise<number> {
    try {
      const filters: Array<{ field: string; operator: string; value: unknown }> = [
        { field: 'metadata.occurredAt', operator: '>=', value: fromTime.toISOString() },
      ];

      if (eventType) {
        filters.push({ field: 'event.type', operator: '==', value: eventType });
      }

      const entries = await this.dataStore.query<OutboxEntry>(
        'event_outbox',
        filters as Array<{ field: string; operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'; value: unknown }>
      );

      let replayedCount = 0;
      for (const entry of entries) {
        // Reset metadata and republish
        await this.dataStore.update('event_outbox', entry.id, {
          'metadata.status': 'pending',
          'metadata.attempts': 0,
          'metadata.lastError': undefined,
        });
        replayedCount++;
      }

      console.log(JSON.stringify({
        event: 'eventbus.replay',
        fromTime: fromTime.toISOString(),
        eventType: eventType || 'all',
        count: replayedCount,
      }));

      return replayedCount;
    } catch (error) {
      throw new Error(`Failed to replay events: ${error}`);
    }
  }
}

// Singleton instance
let eventBus: EventBusImpl | null = null;

export function getEventBus(): EventBus {
  if (!eventBus) {
    eventBus = new EventBusImpl();
  }
  return eventBus;
}

/**
 * Start event bus processing (call on app startup)
 */
export function startEventBusProcessing(): void {
  const bus = getEventBus() as EventBusImpl;
  bus.startProcessing();
}

/**
 * Stop event bus processing (call on app shutdown)
 */
export function stopEventBusProcessing(): void {
  const bus = getEventBus() as EventBusImpl;
  bus.stopProcessing();
}
