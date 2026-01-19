/**
 * Sleep Domain OS
 * Owns sleep data: sleep sessions, quality tracking, patterns
 * 
 * Responsibilities:
 * - CRUD operations for sleep sessions
 * - Sleep quality scoring
 * - Sleep pattern analysis
 * - Goal tracking
 * - Event publishing for sleep changes
 */

import { getDataStore } from '../providers/firebase-datastore';
import { getEventBus } from '../core/event-bus';
import type { EventEnvelope } from '../types';
import { randomUUID } from 'crypto';

// Domain Types
export interface SleepSession {
  id: string;
  userId: string;
  tenantId: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  quality: number;  // 0-100
  notes?: string;
  factors?: {
    caffeine?: boolean;
    exercise?: boolean;
    stress?: number; // 1-5
    screenTime?: number; // minutes before bed
  };
  stages?: {
    deep: number;    // minutes
    light: number;   // minutes
    rem: number;     // minutes
    awake: number;   // minutes
  };
  createdAt: string;
  updatedAt: string;
}

export interface SleepGoals {
  userId: string;
  tenantId: string;
  targetDuration: number; // minutes (e.g., 480 for 8 hours)
  targetBedtime: string;  // HH:mm format
  targetWakeTime: string; // HH:mm format
  updatedAt: string;
}

export interface SleepStats {
  userId: string;
  averageDuration: number;    // minutes
  averageQuality: number;     // 0-100
  consistency: number;        // 0-100 (how consistent bedtime/wake time is)
  goalAdherence: number;      // 0-100
  calculatedAt: string;
}

// Service
class SleepService {
  private dataStore = getDataStore();
  private eventBus = getEventBus();

  // Sleep Session Operations
  async createSleepSession(
    session: Omit<SleepSession, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SleepSession> {
    const now = new Date().toISOString();
    const newSession: SleepSession = {
      ...session,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.dataStore.create(
      `tenants/${session.tenantId}/sleep_sessions`,
      newSession.id,
      newSession
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'sleep.session.logged',
      occurredAt: now,
      tenantId: session.tenantId,
      userId: session.userId,
      actor: { type: 'user', id: session.userId },
      classification: 'internal',
      consentScope: 'sleep',
      traceId: randomUUID(),
      data: { session: newSession },
    } as EventEnvelope<{ session: SleepSession }>);

    return newSession;
  }

  async getSleepSession(sessionId: string, tenantId: string): Promise<SleepSession | null> {
    return await this.dataStore.get<SleepSession>(
      `tenants/${tenantId}/sleep_sessions`,
      sessionId
    );
  }

  async listSleepSessions(
    userId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<SleepSession[]> {
    const sessions = await this.dataStore.query<SleepSession>(
      `tenants/${tenantId}/sleep_sessions`,
      [
        { field: 'userId', operator: '==', value: userId },
        { field: 'startTime', operator: '>=', value: startDate },
        { field: 'startTime', operator: '<=', value: endDate },
      ]
    );

    return sessions.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async updateSleepSession(
    sessionId: string,
    tenantId: string,
    updates: Partial<Omit<SleepSession, 'id' | 'userId' | 'tenantId' | 'createdAt'>>
  ): Promise<SleepSession> {
    const session = await this.getSleepSession(sessionId, tenantId);
    if (!session) {
      throw new Error('Sleep session not found');
    }

    const updatedSession: SleepSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.dataStore.update(
      `tenants/${tenantId}/sleep_sessions`,
      sessionId,
      updatedSession
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'sleep.session.updated',
      occurredAt: updatedSession.updatedAt,
      tenantId,
      userId: session.userId,
      actor: { type: 'user', id: session.userId },
      classification: 'internal',
      consentScope: 'sleep',
      traceId: randomUUID(),
      data: { sessionId, updates },
    } as EventEnvelope<{ sessionId: string; updates: Partial<SleepSession> }>);

    return updatedSession;
  }

  async deleteSleepSession(sessionId: string, tenantId: string, userId: string): Promise<void> {
    await this.dataStore.delete(`tenants/${tenantId}/sleep_sessions`, sessionId);

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'sleep.session.deleted',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: 'internal',
      consentScope: 'sleep',
      traceId: randomUUID(),
      data: { sessionId },
    } as EventEnvelope<{ sessionId: string }>);
  }

  // Sleep Goals
  async setGoals(goals: SleepGoals): Promise<void> {
    const goalsWithTimestamp: SleepGoals = {
      ...goals,
      updatedAt: new Date().toISOString(),
    };

    // Check if goals exist, then update or create
    const existing = await this.dataStore.get<SleepGoals>(
      `tenants/${goals.tenantId}/sleep_goals`,
      goals.userId
    );

    if (existing) {
      await this.dataStore.update(
        `tenants/${goals.tenantId}/sleep_goals`,
        goals.userId,
        goalsWithTimestamp
      );
    } else {
      await this.dataStore.create(
        `tenants/${goals.tenantId}/sleep_goals`,
        goals.userId,
        goalsWithTimestamp
      );
    }

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'sleep.goals.updated',
      occurredAt: goalsWithTimestamp.updatedAt,
      tenantId: goals.tenantId,
      userId: goals.userId,
      actor: { type: 'user', id: goals.userId },
      classification: 'internal',
      consentScope: 'sleep',
      traceId: randomUUID(),
      data: { goals: goalsWithTimestamp },
    } as EventEnvelope<{ goals: SleepGoals }>);
  }

  async getGoals(userId: string, tenantId: string): Promise<SleepGoals | null> {
    return await this.dataStore.get<SleepGoals>(
      `tenants/${tenantId}/sleep_goals`,
      userId
    );
  }

  // Calculate Statistics (last 30 days)
  async calculateStats(userId: string, tenantId: string): Promise<SleepStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString();
    const endDate = new Date().toISOString();

    const sessions = await this.listSleepSessions(userId, tenantId, startDate, endDate);

    if (sessions.length === 0) {
      return {
        userId,
        averageDuration: 0,
        averageQuality: 0,
        consistency: 0,
        goalAdherence: 0,
        calculatedAt: new Date().toISOString(),
      };
    }

    // Calculate averages
    const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
    const avgQuality = sessions.reduce((sum, s) => sum + s.quality, 0) / sessions.length;

    // Calculate consistency (based on bedtime variance)
    const bedtimes = sessions.map(s => {
      const time = new Date(s.startTime);
      return time.getHours() * 60 + time.getMinutes();
    });
    const avgBedtime = bedtimes.reduce((sum, t) => sum + t, 0) / bedtimes.length;
    const variance = bedtimes.reduce((sum, t) => sum + Math.pow(t - avgBedtime, 2), 0) / bedtimes.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, Math.min(100, 100 - (stdDev / 60) * 20)); // Lower std dev = higher consistency

    // Calculate goal adherence
    const goals = await this.getGoals(userId, tenantId);
    let goalAdherence = 0;
    if (goals) {
      const adherentSessions = sessions.filter(s => 
        Math.abs(s.duration - goals.targetDuration) <= 60 // Within 1 hour of goal
      );
      goalAdherence = (adherentSessions.length / sessions.length) * 100;
    }

    return {
      userId,
      averageDuration: Math.round(avgDuration),
      averageQuality: Math.round(avgQuality),
      consistency: Math.round(consistency),
      goalAdherence: Math.round(goalAdherence),
      calculatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
let sleepServiceInstance: SleepService | null = null;

export function getSleepService(): SleepService {
  if (!sleepServiceInstance) {
    sleepServiceInstance = new SleepService();
  }
  return sleepServiceInstance;
}
