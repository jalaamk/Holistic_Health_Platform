/**
 * Event Envelope and Taxonomy
 * Standard event format for the event bus
 */

import { DataClassification, Actor } from '../models/types';

// Event Envelope - All events must use this structure
export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: EventType;
  occurredAt: Date;
  tenantId: string;
  userId: string;
  actor: Actor;
  classification: DataClassification;
  consentScope: ConsentScope;
  traceId: string;
  metadata?: Record<string, unknown>;
  data: T;
}

// Event Types - Taxonomy of all events in the system
export type EventType = 
  // Spine events
  | 'spine.created'
  | 'spine.patch.applied'
  | 'spine.computed.updated'
  
  // Identity events
  | 'identity.user.created'
  | 'identity.user.updated'
  | 'identity.user.deleted'
  | 'identity.session.created'
  | 'identity.session.revoked'
  | 'identity.mfa.enabled'
  
  // Policy & Consent events
  | 'policy.updated'
  | 'consent.granted'
  | 'consent.revoked'
  | 'consent.scope.changed'
  
  // Nutrition events
  | 'nutrition.meal.logged'
  | 'nutrition.meal.updated'
  | 'nutrition.meal.deleted'
  | 'nutrition.goal.set'
  | 'nutrition.goal.achieved'
  
  // Movement events
  | 'movement.workout.logged'
  | 'movement.workout.updated'
  | 'movement.workout.deleted'
  | 'movement.goal.set'
  | 'movement.goal.achieved'
  
  // Sleep events
  | 'sleep.session.logged'
  | 'sleep.session.updated'
  | 'sleep.quality.analyzed'
  
  // Habits events
  | 'habits.completed'
  | 'habits.skipped'
  | 'habits.created'
  | 'habits.updated'
  | 'habits.deleted'
  
  // Mind & Journal events
  | 'journal.entry.created'
  | 'journal.entry.updated'
  | 'journal.entry.deleted'
  | 'mood.logged'
  
  // Sensor events
  | 'sensor.signal.ingested'
  | 'sensor.batch.ingested'
  
  // Timeline events
  | 'timeline.item.added'
  | 'timeline.weekly.generated'
  
  // Rewards events
  | 'rewards.points.earned'
  | 'rewards.streak.updated'
  | 'rewards.achievement.unlocked'
  | 'rewards.challenge.completed'
  
  // Plan events
  | 'plan.created'
  | 'plan.updated'
  | 'plan.completed'
  | 'plan.schedule.updated'
  
  // Notification events
  | 'notification.sent'
  | 'notification.read'
  | 'notification.dismissed'
  
  // Billing events
  | 'billing.subscription.created'
  | 'billing.subscription.updated'
  | 'billing.subscription.cancelled'
  | 'billing.payment.succeeded'
  | 'billing.payment.failed'
  
  // Integration events
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.sync.started'
  | 'integration.sync.completed'
  | 'integration.sync.failed'
  
  // AI events
  | 'ai.inference.requested'
  | 'ai.inference.completed'
  | 'ai.inference.failed'
  | 'ai.quota.exceeded'
  | 'ai.prompt.evaluated';

// Consent Scopes
export type ConsentScope =
  | 'nutrition'
  | 'movement'
  | 'sleep'
  | 'habits'
  | 'journal'
  | 'mood'
  | 'sensors'
  | 'ai_coach'
  | 'analytics'
  | 'sharing'
  | 'integrations'
  | 'professional_access'
  | 'research';

// Event Handler Interface
export interface EventHandler<T = unknown> {
  eventType: EventType;
  handle(event: EventEnvelope<T>): Promise<void>;
  isIdempotent: boolean;
}

// Event Bus Interface
export interface EventBus {
  publish<T>(event: EventEnvelope<T>): Promise<void>;
  subscribe<T>(eventType: EventType, handler: EventHandler<T>): void;
  unsubscribe(eventType: EventType, handler: EventHandler): void;
}

// Outbox Pattern - For atomic event publishing
export interface OutboxEntry {
  id: string;
  eventId: string;
  eventType: EventType;
  payload: string; // JSON serialized EventEnvelope
  status: 'pending' | 'published' | 'failed';
  attempts: number;
  createdAt: Date;
  publishedAt?: Date;
  lastAttemptAt?: Date;
  error?: string;
}

// Idempotency tracking
export interface IdempotencyRecord {
  eventId: string;
  handlerName: string;
  processedAt: Date;
  result?: string;
}
