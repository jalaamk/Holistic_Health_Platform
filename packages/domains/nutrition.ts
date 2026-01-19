/**
 * Nutrition Domain OS
 * Owns nutrition data: meals, macros, calorie tracking
 * 
 * Responsibilities:
 * - CRUD operations for meals
 * - Macro and calorie tracking
 * - Daily nutrition summaries
 * - Goal tracking
 * - Event publishing for nutrition changes
 */

import { getDataStore } from '../providers/firebase-datastore';
import { getEventBus } from '../core/event-bus';
import type { EventEnvelope } from '../types';
import { randomUUID } from 'crypto';

// Domain Types
export interface Meal {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  consumedAt: string;
  calories: number;
  macros: {
    protein: number; // grams
    carbs: number;   // grams
    fat: number;     // grams
  };
  foods?: Array<{
    name: string;
    quantity: string;
    calories: number;
    macros: { protein: number; carbs: number; fat: number };
  }>;
  notes?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionGoals {
  userId: string;
  tenantId: string;
  dailyCalories: number;
  macros: {
    protein: number; // grams
    carbs: number;   // grams
    fat: number;     // grams
  };
  waterGlasses: number;
  updatedAt: string;
}

export interface WaterLog {
  id: string;
  userId: string;
  tenantId: string;
  glasses: number;
  loggedAt: string;
}

export interface DailySummary {
  userId: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  calories: {
    consumed: number;
    goal: number;
    remaining: number;
  };
  macros: {
    protein: { grams: number; percentage: number };
    carbs: { grams: number; percentage: number };
    fat: { grams: number; percentage: number };
  };
  water: {
    glasses: number;
    goal: number;
  };
  mealsCount: number;
  calculatedAt: string;
}

// Service
class NutritionService {
  private dataStore = getDataStore();
  private eventBus = getEventBus();

  // Meal Operations
  async createMeal(meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Meal> {
    const now = new Date().toISOString();
    const newMeal: Meal = {
      ...meal,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await this.dataStore.create(
      `tenants/${meal.tenantId}/meals`,
      newMeal.id,
      newMeal
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'nutrition.meal.logged',
      occurredAt: now,
      tenantId: meal.tenantId,
      userId: meal.userId,
      actor: { type: 'user', id: meal.userId },
      classification: 'internal',
      consentScope: 'nutrition',
      traceId: randomUUID(),
      data: { meal: newMeal },
    } as EventEnvelope<{ meal: Meal }>);

    return newMeal;
  }

  async getMeal(mealId: string, tenantId: string): Promise<Meal | null> {
    return await this.dataStore.get<Meal>(
      `tenants/${tenantId}/meals`,
      mealId
    );
  }

  async listMeals(
    userId: string,
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<Meal[]> {
    const meals = await this.dataStore.query<Meal>(
      `tenants/${tenantId}/meals`,
      [
        { field: 'userId', operator: '==', value: userId },
        { field: 'consumedAt', operator: '>=', value: startDate },
        { field: 'consumedAt', operator: '<=', value: endDate },
      ]
    );

    return meals.sort((a, b) => 
      new Date(b.consumedAt).getTime() - new Date(a.consumedAt).getTime()
    );
  }

  async updateMeal(
    mealId: string,
    tenantId: string,
    updates: Partial<Omit<Meal, 'id' | 'userId' | 'tenantId' | 'createdAt'>>
  ): Promise<Meal> {
    const meal = await this.getMeal(mealId, tenantId);
    if (!meal) {
      throw new Error('Meal not found');
    }

    const updatedMeal: Meal = {
      ...meal,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.dataStore.update(
      `tenants/${tenantId}/meals`,
      mealId,
      updatedMeal
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'nutrition.meal.updated',
      occurredAt: updatedMeal.updatedAt,
      tenantId,
      userId: meal.userId,
      actor: { type: 'user', id: meal.userId },
      classification: 'internal',
      consentScope: 'nutrition',
      traceId: randomUUID(),
      data: { mealId, updates },
    } as EventEnvelope<{ mealId: string; updates: Partial<Meal> }>);

    return updatedMeal;
  }

  async deleteMeal(mealId: string, tenantId: string, userId: string): Promise<void> {
    await this.dataStore.delete(`tenants/${tenantId}/meals`, mealId);

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'nutrition.meal.deleted',
      occurredAt: new Date().toISOString(),
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: 'internal',
      consentScope: 'nutrition',
      traceId: randomUUID(),
      data: { mealId },
    } as EventEnvelope<{ mealId: string }>);
  }

  // Nutrition Goals
  async setGoals(goals: NutritionGoals): Promise<void> {
    const goalsWithTimestamp: NutritionGoals = {
      ...goals,
      updatedAt: new Date().toISOString(),
    };

    // Check if goals exist, then update or create
    const existing = await this.dataStore.get<NutritionGoals>(
      `tenants/${goals.tenantId}/nutrition_goals`,
      goals.userId
    );

    if (existing) {
      await this.dataStore.update(
        `tenants/${goals.tenantId}/nutrition_goals`,
        goals.userId,
        goalsWithTimestamp
      );
    } else {
      await this.dataStore.create(
        `tenants/${goals.tenantId}/nutrition_goals`,
        goals.userId,
        goalsWithTimestamp
      );
    }

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'nutrition.goals.updated',
      occurredAt: goalsWithTimestamp.updatedAt,
      tenantId: goals.tenantId,
      userId: goals.userId,
      actor: { type: 'user', id: goals.userId },
      classification: 'internal',
      consentScope: 'nutrition',
      traceId: randomUUID(),
      data: { goals: goalsWithTimestamp },
    } as EventEnvelope<{ goals: NutritionGoals }>);
  }

  async getGoals(userId: string, tenantId: string): Promise<NutritionGoals | null> {
    return await this.dataStore.get<NutritionGoals>(
      `tenants/${tenantId}/nutrition_goals`,
      userId
    );
  }

  // Water Logging
  async logWater(
    userId: string,
    tenantId: string,
    glasses: number
  ): Promise<WaterLog> {
    const now = new Date().toISOString();
    const waterLog: WaterLog = {
      id: randomUUID(),
      userId,
      tenantId,
      glasses,
      loggedAt: now,
    };

    await this.dataStore.create(
      `tenants/${tenantId}/water_logs`,
      waterLog.id,
      waterLog
    );

    // Publish event
    await this.eventBus.publish({
      eventId: randomUUID(),
      type: 'nutrition.water.logged',
      occurredAt: now,
      tenantId,
      userId,
      actor: { type: 'user', id: userId },
      classification: 'internal',
      consentScope: 'nutrition',
      traceId: randomUUID(),
      data: { waterLog },
    } as EventEnvelope<{ waterLog: WaterLog }>);

    return waterLog;
  }

  async getTodayWater(userId: string, tenantId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.toISOString();
    const endOfDay = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const logs = await this.dataStore.query<WaterLog>(
      `tenants/${tenantId}/water_logs`,
      [
        { field: 'userId', operator: '==', value: userId },
        { field: 'loggedAt', operator: '>=', value: startOfDay },
        { field: 'loggedAt', operator: '<', value: endOfDay },
      ]
    );

    return logs.reduce((sum, log) => sum + log.glasses, 0);
  }

  // Daily Summary Calculation
  async calculateDailySummary(
    userId: string,
    tenantId: string,
    date: string // YYYY-MM-DD
  ): Promise<DailySummary> {
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    // Get meals for the day
    const meals = await this.listMeals(userId, tenantId, startOfDay, endOfDay);

    // Calculate totals
    const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
    const totalProtein = meals.reduce((sum, meal) => sum + meal.macros.protein, 0);
    const totalCarbs = meals.reduce((sum, meal) => sum + meal.macros.carbs, 0);
    const totalFat = meals.reduce((sum, meal) => sum + meal.macros.fat, 0);

    // Get goals
    const goals = await this.getGoals(userId, tenantId) || {
      userId,
      tenantId,
      dailyCalories: 2000,
      macros: { protein: 150, carbs: 225, fat: 67 },
      waterGlasses: 8,
      updatedAt: new Date().toISOString(),
    };

    // Get water intake
    const waterGlasses = await this.getTodayWater(userId, tenantId);

    // Calculate macro percentages
    const totalMacroCalories = (totalProtein * 4) + (totalCarbs * 4) + (totalFat * 9);
    const proteinPercentage = totalMacroCalories > 0 
      ? Math.round((totalProtein * 4 / totalMacroCalories) * 100) 
      : 0;
    const carbsPercentage = totalMacroCalories > 0 
      ? Math.round((totalCarbs * 4 / totalMacroCalories) * 100) 
      : 0;
    const fatPercentage = totalMacroCalories > 0 
      ? Math.round((totalFat * 9 / totalMacroCalories) * 100) 
      : 0;

    return {
      userId,
      tenantId,
      date,
      calories: {
        consumed: totalCalories,
        goal: goals.dailyCalories,
        remaining: goals.dailyCalories - totalCalories,
      },
      macros: {
        protein: { grams: totalProtein, percentage: proteinPercentage },
        carbs: { grams: totalCarbs, percentage: carbsPercentage },
        fat: { grams: totalFat, percentage: fatPercentage },
      },
      water: {
        glasses: waterGlasses,
        goal: goals.waterGlasses,
      },
      mealsCount: meals.length,
      calculatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
let nutritionServiceInstance: NutritionService | null = null;

export function getNutritionService(): NutritionService {
  if (!nutritionServiceInstance) {
    nutritionServiceInstance = new NutritionService();
  }
  return nutritionServiceInstance;
}
