/**
 * Habits Domain OS
 * Owns habits data: logs, streaks, completion tracking
 * 
 * Responsibilities:
 * - CRUD operations for habits
 * - Habit completion tracking
 * - Streak calculation
 * - Category management
 * - Event publishing for habit changes
 */

import { getDataStore } from '../providers/firebase-datastore';
import { getEventBus } from '../core/event-bus';
import type { EventEnvelope } from '../types';
import { randomUUID } from 'crypto';

// Domain Types
export interface Habit {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  description?: string;
  category: 'mind' | 'movement' | 'nutrition' | 'sleep' | 'learning' | 'other';
  targetFrequency: 'daily' | 'weekly' | 'custom';
  customFrequency?: {
    timesPerWeek?: number;
    daysOfWeek?: number[]; // 0-6, Sunday=0
  };
  reminderTime?: string; // HH:mm format
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  userId: string;
  tenantId: string;
  completedAt: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface HabitStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastCompletedAt?: string;
  completionRate: number; // 0-100
  calculatedAt: string;
}

// Service
class HabitsService {
  private dataStore = getDataStore();
  private eventBus = getEventBus();

  // Create a new habit
  async createHabit(habit: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Habit> {
    const now = new Date().toISOString();
    const newHabit: Habit = {
      ...habit,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.dataStore.create(
      `tenants/${habit.tenantId}/habits`,
      newHabit.id,
      newHabit
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'habits.habit.created',
      occurredAt: now,
      tenantId: habit.tenantId,
      userId: habit.userId,
      actor: { type: 'user', id: habit.userId },
      classification: 'internal',
      consentScope: 'habits',
      traceId: randomUUID(),
      data: { habit: newHabit },
    } as EventEnvelope<{ habit: Habit }>);

    return newHabit;
  }

  // Get habit by ID
  async getHabit(habitId: string, tenantId: string): Promise<Habit | null> {
    return await this.dataStore.get<Habit>(
      `tenants/${tenantId}/habits`,
      habitId
    );
  }

  // List habits for a user
  async listHabits(
    userId: string,
    tenantId: string,
    activeOnly: boolean = true
  ): Promise<Habit[]> {
    const filters: Array<{ field: string; operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'; value: unknown }> = [
      { field: 'userId', operator: '==', value: userId },
    ];
    
    if (activeOnly) {
      filters.push({ field: 'isActive', operator: '==', value: true });
    }

    const habits = await this.dataStore.query<Habit>(
      `tenants/${tenantId}/habits`,
      filters
    );

    return habits.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Update habit
  async updateHabit(
    habitId: string,
    tenantId: string,
    updates: Partial<Omit<Habit, 'id' | 'userId' | 'tenantId' | 'createdAt'>>
  ): Promise<Habit> {
    const habit = await this.getHabit(habitId, tenantId);
    if (!habit) {
      throw new Error('Habit not found');
    }

    const updatedHabit: Habit = {
      ...habit,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.dataStore.update(
      `tenants/${tenantId}/habits`,
      habitId,
      updatedHabit
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'habits.habit.updated',
      occurredAt: updatedHabit.updatedAt,
      tenantId,
      userId: habit.userId,
      actor: { type: 'user', id: habit.userId },
      classification: 'internal',
      consentScope: 'habits',
      traceId: randomUUID(),
      data: { habitId, updates },
    } as EventEnvelope<{ habitId: string; updates: Partial<Habit> }>);

    return updatedHabit;
  }

  // Delete (soft delete) habit
  async deleteHabit(habitId: string, tenantId: string, userId: string): Promise<void> {
    await this.updateHabit(habitId, tenantId, { isActive: false });

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'habits.habit.deleted',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: 'internal',
      consentScope: 'habits',
      traceId: randomUUID(),
      data: { habitId },
    } as EventEnvelope<{ habitId: string }>);
  }

  // Complete a habit
  async completeHabit(
    habitId: string,
    userId: string,
    tenantId: string,
    note?: string,
    completedAt?: string
  ): Promise<HabitCompletion> {
    const habit = await this.getHabit(habitId, tenantId);
    if (!habit) {
      throw new Error('Habit not found');
    }

    const now = completedAt || new Date().toISOString();
    const completion: HabitCompletion = {
      id: randomUUID(),
      habitId,
      userId,
      tenantId,
      completedAt: now,
      note,
    };

    await this.dataStore.create(
      `tenants/${tenantId}/habit_completions`,
      completion.id,
      completion
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'habits.completed',
      occurredAt: now,
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: 'internal',
      consentScope: 'habits',
      traceId: randomUUID(),
      data: { completion },
    } as EventEnvelope<{ completion: HabitCompletion }>);

    return completion;
  }

  // Get completions for a habit in a date range
  async getCompletions(
    habitId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<HabitCompletion[]> {
    const completions = await this.dataStore.query<HabitCompletion>(
      `tenants/${tenantId}/habit_completions`,
      [
        { field: 'habitId', operator: '==', value: habitId },
        { field: 'completedAt', operator: '>=', value: startDate },
        { field: 'completedAt', operator: '<=', value: endDate },
      ]
    );

    return completions.sort((a, b) => 
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );
  }

  // Get today's completions for a user
  async getTodayCompletions(
    userId: string,
    tenantId: string
  ): Promise<HabitCompletion[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.toISOString();
    const endOfDay = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const completions = await this.dataStore.query<HabitCompletion>(
      `tenants/${tenantId}/habit_completions`,
      [
        { field: 'userId', operator: '==', value: userId },
        { field: 'completedAt', operator: '>=', value: startOfDay },
        { field: 'completedAt', operator: '<', value: endOfDay },
      ]
    );

    return completions;
  }

  // Calculate habit statistics
  async calculateStats(habitId: string, tenantId: string): Promise<HabitStats> {
    // Get all completions for this habit
    const allCompletions = await this.dataStore.query<HabitCompletion>(
      `tenants/${tenantId}/habit_completions`,
      [{ field: 'habitId', operator: '==', value: habitId }]
    );

    if (allCompletions.length === 0) {
      return {
        habitId,
        currentStreak: 0,
        longestStreak: 0,
        totalCompletions: 0,
        completionRate: 0,
        calculatedAt: new Date().toISOString(),
      };
    }

    // Sort by date
    const sorted = allCompletions.sort((a, b) => 
      new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const completion of sorted) {
      const completionDate = new Date(completion.completedAt);
      completionDate.setHours(0, 0, 0, 0);

      if (lastDate === null) {
        tempStreak = 1;
      } else {
        const daysDiff = Math.floor((completionDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysDiff === 1) {
          tempStreak++;
        } else if (daysDiff === 0) {
          // Same day, don't increment
        } else {
          // Streak broken
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }

      lastDate = completionDate;
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    // Current streak only counts if last completion was today or yesterday
    if (lastDate) {
      const daysSinceLastCompletion = Math.floor((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceLastCompletion <= 1) {
        currentStreak = tempStreak;
      }
    }

    // Calculate completion rate (last 30 days)
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentCompletions = allCompletions.filter(c => 
      new Date(c.completedAt) >= thirtyDaysAgo
    );
    const completionRate = Math.round((recentCompletions.length / 30) * 100);

    return {
      habitId,
      currentStreak,
      longestStreak,
      totalCompletions: allCompletions.length,
      lastCompletedAt: sorted[sorted.length - 1].completedAt,
      completionRate,
      calculatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
let habitsServiceInstance: HabitsService | null = null;

export function getHabitsService(): HabitsService {
  if (!habitsServiceInstance) {
    habitsServiceInstance = new HabitsService();
  }
  return habitsServiceInstance;
}
