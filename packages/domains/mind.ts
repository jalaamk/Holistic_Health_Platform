/**
 * Mind Domain OS
 * Owns mind/mental health data: journal entries, mood tracking, mindfulness sessions
 * 
 * Responsibilities:
 * - CRUD operations for journal entries
 * - Mood tracking
 * - Mindfulness/meditation session logging
 * - Mental health insights
 * - Event publishing for mind changes
 */

import { getDataStore } from '../providers/firebase-datastore';
import { getEventBus } from '../core/event-bus';
import { DataClassification, type EventEnvelope } from '../types';
import { randomUUID } from 'crypto';

// Domain Types
export interface JournalEntry {
  id: string;
  userId: string;
  tenantId: string;
  title?: string;
  content: string;
  mood?: 'excellent' | 'good' | 'neutral' | 'bad' | 'terrible';
  tags?: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MoodLog {
  id: string;
  userId: string;
  tenantId: string;
  mood: 'excellent' | 'good' | 'neutral' | 'bad' | 'terrible';
  intensity: number; // 1-5
  notes?: string;
  triggers?: string[];
  activities?: string[];
  loggedAt: string;
}

export interface MindfulnessSession {
  id: string;
  userId: string;
  tenantId: string;
  type: 'meditation' | 'breathing' | 'yoga' | 'other';
  duration: number; // minutes
  startTime: string;
  endTime: string;
  notes?: string;
  createdAt: string;
}

export interface MoodStats {
  userId: string;
  averageMood: number; // 1-5 scale
  moodTrend: 'improving' | 'stable' | 'declining';
  mostCommonMood: string;
  calculatedAt: string;
}

// Service
class MindService {
  private dataStore = getDataStore();
  private eventBus = getEventBus();

  // Journal Entry Operations
  async createJournalEntry(
    entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<JournalEntry> {
    const now = new Date().toISOString();
    const newEntry: JournalEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.dataStore.create(
      `tenants/${entry.tenantId}/journal_entries`,
      newEntry.id,
      newEntry
    );

    // Publish event (with sensitive classification for private entries)
    const classification: DataClassification = entry.isPrivate 
      ? DataClassification.SENSITIVE 
      : DataClassification.INTERNAL;
    
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'mind.journal.created',
      occurredAt: now,
      tenantId: entry.tenantId,
      userId: entry.userId,
      actor: { type: 'user', id: entry.userId },
      classification,
      consentScope: 'mind',
      traceId: randomUUID(),
      data: { entryId: newEntry.id, mood: newEntry.mood, tags: newEntry.tags },
    } as EventEnvelope<{ entryId: string; mood?: string; tags?: string[] }>);

    return newEntry;
  }

  async getJournalEntry(entryId: string, tenantId: string): Promise<JournalEntry | null> {
    return await this.dataStore.get<JournalEntry>(
      `tenants/${tenantId}/journal_entries`,
      entryId
    );
  }

  async listJournalEntries(
    userId: string,
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<JournalEntry[]> {
    const filters: Array<{ field: string; operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'; value: unknown }> = [
      { field: 'userId', operator: '==', value: userId },
    ];

    if (startDate) {
      filters.push({ field: 'createdAt', operator: '>=', value: startDate });
    }
    if (endDate) {
      filters.push({ field: 'createdAt', operator: '<=', value: endDate });
    }

    const entries = await this.dataStore.query<JournalEntry>(
      `tenants/${tenantId}/journal_entries`,
      filters
    );

    return entries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateJournalEntry(
    entryId: string,
    tenantId: string,
    updates: Partial<Omit<JournalEntry, 'id' | 'userId' | 'tenantId' | 'createdAt'>>
  ): Promise<JournalEntry> {
    const entry = await this.getJournalEntry(entryId, tenantId);
    if (!entry) {
      throw new Error('Journal entry not found');
    }

    const updatedEntry: JournalEntry = {
      ...entry,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.dataStore.update(
      `tenants/${tenantId}/journal_entries`,
      entryId,
      updatedEntry
    );

    // Publish event
    const classification: DataClassification = updatedEntry.isPrivate 
      ? DataClassification.SENSITIVE 
      : DataClassification.INTERNAL;
    
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'mind.journal.updated',
      occurredAt: updatedEntry.updatedAt,
      tenantId,
      userId: entry.userId,
      actor: { type: 'user', id: entry.userId },
      classification,
      consentScope: 'mind',
      traceId: randomUUID(),
      data: { entryId },
    } as EventEnvelope<{ entryId: string }>);

    return updatedEntry;
  }

  async deleteJournalEntry(entryId: string, tenantId: string, userId: string): Promise<void> {
    await this.dataStore.delete(`tenants/${tenantId}/journal_entries`, entryId);

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'mind.journal.deleted',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: 'internal',
      consentScope: 'mind',
      traceId: randomUUID(),
      data: { entryId },
    } as EventEnvelope<{ entryId: string }>);
  }

  // Mood Tracking
  async logMood(
    mood: Omit<MoodLog, 'id'>
  ): Promise<MoodLog> {
    const newMood: MoodLog = {
      ...mood,
      id: randomUUID(),
    };

    await this.dataStore.create(
      `tenants/${mood.tenantId}/mood_logs`,
      newMood.id,
      newMood
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'mind.mood.logged',
      occurredAt: mood.loggedAt,
      tenantId: mood.tenantId,
      userId: mood.userId,
      actor: { type: 'user', id: mood.userId },
      classification: 'internal',
      consentScope: 'mind',
      traceId: randomUUID(),
      data: { mood: newMood },
    } as EventEnvelope<{ mood: MoodLog }>);

    return newMood;
  }

  async getMoodLogs(
    userId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<MoodLog[]> {
    const logs = await this.dataStore.query<MoodLog>(
      `tenants/${tenantId}/mood_logs`,
      [
        { field: 'userId', operator: '==', value: userId },
        { field: 'loggedAt', operator: '>=', value: startDate },
        { field: 'loggedAt', operator: '<=', value: endDate },
      ]
    );

    return logs.sort((a, b) => 
      new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
    );
  }

  // Mindfulness Sessions
  async logMindfulnessSession(
    session: Omit<MindfulnessSession, 'id' | 'createdAt'>
  ): Promise<MindfulnessSession> {
    const now = new Date().toISOString();
    const newSession: MindfulnessSession = {
      ...session,
      id: randomUUID(),
      createdAt: now,
    };

    await this.dataStore.create(
      `tenants/${session.tenantId}/mindfulness_sessions`,
      newSession.id,
      newSession
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'mind.mindfulness.logged',
      occurredAt: now,
      tenantId: session.tenantId,
      userId: session.userId,
      actor: { type: 'user', id: session.userId },
      classification: 'internal',
      consentScope: 'mind',
      traceId: randomUUID(),
      data: { session: newSession },
    } as EventEnvelope<{ session: MindfulnessSession }>);

    return newSession;
  }

  async getMindfulnessSessions(
    userId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<MindfulnessSession[]> {
    const sessions = await this.dataStore.query<MindfulnessSession>(
      `tenants/${tenantId}/mindfulness_sessions`,
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

  // Calculate Mood Statistics (last 30 days)
  async calculateMoodStats(userId: string, tenantId: string): Promise<MoodStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString();
    const endDate = new Date().toISOString();

    const logs = await this.getMoodLogs(userId, tenantId, startDate, endDate);

    if (logs.length === 0) {
      return {
        userId,
        averageMood: 3, // neutral
        moodTrend: 'stable',
        mostCommonMood: 'neutral',
        calculatedAt: new Date().toISOString(),
      };
    }

    // Map moods to numeric values
    const moodValues: Record<string, number> = {
      'terrible': 1,
      'bad': 2,
      'neutral': 3,
      'good': 4,
      'excellent': 5,
    };

    // Calculate average
    const numericMoods = logs.map(log => moodValues[log.mood] || 3);
    const avgMood = numericMoods.reduce((sum, val) => sum + val, 0) / numericMoods.length;

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(logs.length / 2);
    const firstHalfAvg = numericMoods.slice(0, midpoint).reduce((sum, val) => sum + val, 0) / midpoint;
    const secondHalfAvg = numericMoods.slice(midpoint).reduce((sum, val) => sum + val, 0) / (logs.length - midpoint);
    
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (secondHalfAvg > firstHalfAvg + 0.3) {
      trend = 'improving';
    } else if (secondHalfAvg < firstHalfAvg - 0.3) {
      trend = 'declining';
    }

    // Find most common mood
    const moodCounts: Record<string, number> = {};
    logs.forEach(log => {
      moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
    });
    const mostCommonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    return {
      userId,
      averageMood: Math.round(avgMood * 10) / 10,
      moodTrend: trend,
      mostCommonMood,
      calculatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
let mindServiceInstance: MindService | null = null;

export function getMindService(): MindService {
  if (!mindServiceInstance) {
    mindServiceInstance = new MindService();
  }
  return mindServiceInstance;
}
