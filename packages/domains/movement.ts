/**
 * Movement Domain OS
 * Owns movement data: workouts, activity tracking, exercise logs
 * 
 * Responsibilities:
 * - CRUD operations for workouts
 * - Activity tracking
 * - Exercise performance metrics
 * - Goal tracking
 * - Event publishing for movement changes
 */

import { getDataStore } from '../providers/firebase-datastore';
import { getEventBus } from '../core/event-bus';
import type { EventEnvelope } from '../types';
import { randomUUID } from 'crypto';

// Domain Types
export interface Workout {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  type: 'cardio' | 'strength' | 'flexibility' | 'sports' | 'other';
  startTime: string;
  endTime: string;
  duration: number; // minutes
  intensity: 'low' | 'moderate' | 'high';
  caloriesBurned?: number;
  exercises?: Array<{
    name: string;
    sets?: number;
    reps?: number;
    weight?: number;
    duration?: number; // seconds
    distance?: number; // meters
  }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MovementGoals {
  userId: string;
  tenantId: string;
  weeklyWorkouts: number;
  weeklyMinutes: number;
  weeklyCalories: number;
  updatedAt: string;
}

export interface MovementStats {
  userId: string;
  weeklyWorkouts: number;
  weeklyMinutes: number;
  weeklyCalories: number;
  favoriteType: string;
  calculatedAt: string;
}

// Service
class MovementService {
  private dataStore = getDataStore();
  private eventBus = getEventBus();

  // Workout Operations
  async createWorkout(
    workout: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Workout> {
    const now = new Date().toISOString();
    const newWorkout: Workout = {
      ...workout,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.dataStore.create(
      `tenants/${workout.tenantId}/workouts`,
      newWorkout.id,
      newWorkout
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'movement.workout.logged',
      occurredAt: now,
      tenantId: workout.tenantId,
      userId: workout.userId,
      actor: { type: 'user', id: workout.userId },
      classification: 'internal',
      consentScope: 'movement',
      traceId: randomUUID(),
      data: { workout: newWorkout },
    } as EventEnvelope<{ workout: Workout }>);

    return newWorkout;
  }

  async getWorkout(workoutId: string, tenantId: string): Promise<Workout | null> {
    return await this.dataStore.get<Workout>(
      `tenants/${tenantId}/workouts`,
      workoutId
    );
  }

  async listWorkouts(
    userId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Workout[]> {
    const workouts = await this.dataStore.query<Workout>(
      `tenants/${tenantId}/workouts`,
      [
        { field: 'userId', operator: '==', value: userId },
        { field: 'startTime', operator: '>=', value: startDate },
        { field: 'startTime', operator: '<=', value: endDate },
      ]
    );

    return workouts.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async updateWorkout(
    workoutId: string,
    tenantId: string,
    updates: Partial<Omit<Workout, 'id' | 'userId' | 'tenantId' | 'createdAt'>>
  ): Promise<Workout> {
    const workout = await this.getWorkout(workoutId, tenantId);
    if (!workout) {
      throw new Error('Workout not found');
    }

    const updatedWorkout: Workout = {
      ...workout,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.dataStore.update(
      `tenants/${tenantId}/workouts`,
      workoutId,
      updatedWorkout
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'movement.workout.updated',
      occurredAt: updatedWorkout.updatedAt,
      tenantId,
      userId: workout.userId,
      actor: { type: 'user', id: workout.userId },
      classification: 'internal',
      consentScope: 'movement',
      traceId: randomUUID(),
      data: { workoutId, updates },
    } as EventEnvelope<{ workoutId: string; updates: Partial<Workout> }>);

    return updatedWorkout;
  }

  async deleteWorkout(workoutId: string, tenantId: string, userId: string): Promise<void> {
    await this.dataStore.delete(`tenants/${tenantId}/workouts`, workoutId);

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'movement.workout.deleted',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: 'internal',
      consentScope: 'movement',
      traceId: randomUUID(),
      data: { workoutId },
    } as EventEnvelope<{ workoutId: string }>);
  }

  // Movement Goals
  async setGoals(goals: MovementGoals): Promise<void> {
    const goalsWithTimestamp: MovementGoals = {
      ...goals,
      updatedAt: new Date().toISOString(),
    };

    // Check if goals exist, then update or create
    const existing = await this.dataStore.get<MovementGoals>(
      `tenants/${goals.tenantId}/movement_goals`,
      goals.userId
    );

    if (existing) {
      await this.dataStore.update(
        `tenants/${goals.tenantId}/movement_goals`,
        goals.userId,
        goalsWithTimestamp
      );
    } else {
      await this.dataStore.create(
        `tenants/${goals.tenantId}/movement_goals`,
        goals.userId,
        goalsWithTimestamp
      );
    }

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'movement.goals.updated',
      occurredAt: goalsWithTimestamp.updatedAt,
      tenantId: goals.tenantId,
      userId: goals.userId,
      actor: { type: 'user', id: goals.userId },
      classification: 'internal',
      consentScope: 'movement',
      traceId: randomUUID(),
      data: { goals: goalsWithTimestamp },
    } as EventEnvelope<{ goals: MovementGoals }>);
  }

  async getGoals(userId: string, tenantId: string): Promise<MovementGoals | null> {
    return await this.dataStore.get<MovementGoals>(
      `tenants/${tenantId}/movement_goals`,
      userId
    );
  }

  // Calculate Weekly Statistics
  async calculateWeeklyStats(userId: string, tenantId: string): Promise<MovementStats> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString();
    const endDate = new Date().toISOString();

    const workouts = await this.listWorkouts(userId, tenantId, startDate, endDate);

    if (workouts.length === 0) {
      return {
        userId,
        weeklyWorkouts: 0,
        weeklyMinutes: 0,
        weeklyCalories: 0,
        favoriteType: 'none',
        calculatedAt: new Date().toISOString(),
      };
    }

    // Calculate totals
    const totalMinutes = workouts.reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

    // Find favorite type
    const typeCounts: Record<string, number> = {};
    workouts.forEach(w => {
      typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    });
    const favoriteType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    return {
      userId,
      weeklyWorkouts: workouts.length,
      weeklyMinutes: totalMinutes,
      weeklyCalories: totalCalories,
      favoriteType,
      calculatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
let movementServiceInstance: MovementService | null = null;

export function getMovementService(): MovementService {
  if (!movementServiceInstance) {
    movementServiceInstance = new MovementService();
  }
  return movementServiceInstance;
}
