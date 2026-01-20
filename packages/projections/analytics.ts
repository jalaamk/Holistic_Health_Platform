/**
 * Analytics Projection Service
 * 
 * Subscribes to domain events and maintains analytics aggregations:
 * - Daily/weekly/monthly activity metrics
 * - Domain-specific KPIs (habits completion rate, nutrition adherence, etc.)
 * - Engagement metrics (active days, session counts)
 * - Trend analysis (moving averages, growth rates)
 * 
 * This projection enables fast analytics queries without scanning raw event data.
 */

import { getEventBus } from '@/packages/core/event-bus';
import { getDataStore } from '@/packages/providers/firebase-datastore';
import type { EventEnvelope } from '@/packages/providers/interfaces';

// ============================================================================
// Types
// ============================================================================

export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  userId: string;
  tenantId: string;
  
  // Activity counts
  habitCompletions: number;
  mealsLogged: number;
  workoutsCompleted: number;
  sleepSessionsLogged: number;
  journalEntriesCreated: number;
  moodsLogged: number;
  mindfulnessSessions: number;
  
  // Totals
  totalActivities: number;
  totalXpEarned: number;
  
  // Domain-specific
  caloriesConsumed: number;
  waterIntakeMl: number;
  workoutMinutes: number;
  sleepHours: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyMetrics {
  weekStartDate: string; // YYYY-MM-DD (Monday)
  userId: string;
  tenantId: string;
  
  // Aggregated counts
  totalHabitCompletions: number;
  totalMeals: number;
  totalWorkouts: number;
  totalSleepSessions: number;
  totalJournalEntries: number;
  totalActivities: number;
  
  // Averages
  avgActivitiesPerDay: number;
  avgCaloriesPerDay: number;
  avgWorkoutMinutesPerDay: number;
  avgSleepHoursPerDay: number;
  
  // Engagement
  activeDays: number; // Days with at least 1 activity
  streakDays: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface UserKPIs {
  userId: string;
  tenantId: string;
  
  // Current period (last 7 days)
  currentPeriod: {
    activeDays: number;
    totalActivities: number;
    habitCompletionRate: number; // 0-100
    avgDailyCalories: number;
    avgDailyWorkoutMinutes: number;
    avgDailySleepHours: number;
  };
  
  // Previous period (prior 7 days) for trend calculation
  previousPeriod: {
    activeDays: number;
    totalActivities: number;
    habitCompletionRate: number;
    avgDailyCalories: number;
    avgDailyWorkoutMinutes: number;
    avgDailySleepHours: number;
  };
  
  // Trends (positive = improving, negative = declining)
  trends: {
    activeDaysTrend: number; // percentage change
    activityTrend: number;
    habitTrend: number;
    nutritionTrend: number;
    workoutTrend: number;
    sleepTrend: number;
  };
  
  // All-time stats
  allTime: {
    totalActivities: number;
    longestStreak: number;
    totalXpEarned: number;
    joinedDate: string;
  };
  
  updatedAt: string;
}

// ============================================================================
// Analytics Service
// ============================================================================

class AnalyticsService {
  private dataStore = getDataStore();
  private initialized = false;

  /**
   * Initialize event subscribers
   */
  public initialize(): void {
    if (this.initialized) return;
    
    const eventBus = getEventBus();
    
    // Subscribe to all domain events
    eventBus.subscribe('habits.completed', this.handleHabitCompleted.bind(this));
    eventBus.subscribe('nutrition.meal.logged', this.handleMealLogged.bind(this));
    eventBus.subscribe('nutrition.water.logged', this.handleWaterLogged.bind(this));
    eventBus.subscribe('movement.workout.logged', this.handleWorkoutLogged.bind(this));
    eventBus.subscribe('sleep.session.logged', this.handleSleepLogged.bind(this));
    eventBus.subscribe('mind.journal.created', this.handleJournalCreated.bind(this));
    eventBus.subscribe('mind.mood.logged', this.handleMoodLogged.bind(this));
    eventBus.subscribe('mind.mindfulness.logged', this.handleMindfulnessLogged.bind(this));
    
    this.initialized = true;
    console.log('[AnalyticsService] Initialized with event subscribers');
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  private async handleHabitCompleted(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'habitCompletions',
      1
    );
  }

  private async handleMealLogged(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    const calories = event.data?.calories || 0;
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'mealsLogged',
      1
    );
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'caloriesConsumed',
      calories
    );
  }

  private async handleWaterLogged(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    const amount = event.data?.amount || 0;
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'waterIntakeMl',
      amount
    );
  }

  private async handleWorkoutLogged(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    const duration = event.data?.duration || 0;
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'workoutsCompleted',
      1
    );
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'workoutMinutes',
      duration
    );
  }

  private async handleSleepLogged(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    const startTime = event.data?.startTime ? new Date(event.data.startTime).getTime() : 0;
    const endTime = event.data?.endTime ? new Date(event.data.endTime).getTime() : 0;
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'sleepSessionsLogged',
      1
    );
    
    if (hours > 0 && hours < 24) {
      await this.incrementMetric(
        event.userId,
        event.tenantId,
        new Date(event.occurredAt),
        'sleepHours',
        hours
      );
    }
  }

  private async handleJournalCreated(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'journalEntriesCreated',
      1
    );
  }

  private async handleMoodLogged(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'moodsLogged',
      1
    );
  }

  private async handleMindfulnessLogged(event: EventEnvelope<any>): Promise<void> {
    if (!event.userId || !event.tenantId) return;
    
    await this.incrementMetric(
      event.userId,
      event.tenantId,
      new Date(event.occurredAt),
      'mindfulnessSessions',
      1
    );
  }

  // ==========================================================================
  // Metric Updates
  // ==========================================================================

  private async incrementMetric(
    userId: string,
    tenantId: string,
    date: Date,
    metricName: keyof Omit<DailyMetrics, 'date' | 'userId' | 'tenantId' | 'createdAt' | 'updatedAt'>,
    value: number
  ): Promise<void> {
    const dateStr = this.formatDate(date);
    const docId = `${tenantId}_${userId}_${dateStr}`;
    
    try {
      const existing = await this.dataStore.get<DailyMetrics>('daily_metrics', docId);
      
      const now = new Date().toISOString();
      
      const updated: DailyMetrics = existing || {
        date: dateStr,
        userId,
        tenantId,
        habitCompletions: 0,
        mealsLogged: 0,
        workoutsCompleted: 0,
        sleepSessionsLogged: 0,
        journalEntriesCreated: 0,
        moodsLogged: 0,
        mindfulnessSessions: 0,
        totalActivities: 0,
        totalXpEarned: 0,
        caloriesConsumed: 0,
        waterIntakeMl: 0,
        workoutMinutes: 0,
        sleepHours: 0,
        createdAt: now,
        updatedAt: now,
      };
      
      // Increment the specific metric
      (updated[metricName] as number) += value;
      
      // Update totals
      updated.totalActivities = 
        updated.habitCompletions +
        updated.mealsLogged +
        updated.workoutsCompleted +
        updated.sleepSessionsLogged +
        updated.journalEntriesCreated +
        updated.moodsLogged +
        updated.mindfulnessSessions;
      
      updated.updatedAt = now;
      
      if (existing) {
        await this.dataStore.update('daily_metrics', docId, updated);
      } else {
        await this.dataStore.create('daily_metrics', docId, updated);
      }
      
      // Also update weekly aggregation
      await this.updateWeeklyMetrics(userId, tenantId, date);
      
    } catch (error) {
      console.error('[AnalyticsService] Error incrementing metric:', error);
    }
  }

  private async updateWeeklyMetrics(
    userId: string,
    tenantId: string,
    date: Date
  ): Promise<void> {
    const weekStart = this.getWeekStart(date);
    const weekStartStr = this.formatDate(weekStart);
    const docId = `${tenantId}_${userId}_${weekStartStr}`;
    
    // This is a simplified version - in production, you'd aggregate from daily metrics
    // For now, just mark it as updated
    try {
      const existing = await this.dataStore.get<WeeklyMetrics>('weekly_metrics', docId);
      
      if (!existing) {
        const weekMetrics: WeeklyMetrics = {
          weekStartDate: weekStartStr,
          userId,
          tenantId,
          totalHabitCompletions: 0,
          totalMeals: 0,
          totalWorkouts: 0,
          totalSleepSessions: 0,
          totalJournalEntries: 0,
          totalActivities: 0,
          avgActivitiesPerDay: 0,
          avgCaloriesPerDay: 0,
          avgWorkoutMinutesPerDay: 0,
          avgSleepHoursPerDay: 0,
          activeDays: 0,
          streakDays: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        await this.dataStore.create('weekly_metrics', docId, weekMetrics);
      } else {
        existing.updatedAt = new Date().toISOString();
        await this.dataStore.update('weekly_metrics', docId, { updatedAt: existing.updatedAt });
      }
    } catch (error) {
      console.error('[AnalyticsService] Error updating weekly metrics:', error);
    }
  }

  // ==========================================================================
  // Query APIs
  // ==========================================================================

  /**
   * Get daily metrics for a specific date
   */
  public async getDailyMetrics(
    userId: string,
    tenantId: string,
    date: Date
  ): Promise<DailyMetrics | null> {
    const dateStr = this.formatDate(date);
    const docId = `${tenantId}_${userId}_${dateStr}`;
    
    return this.dataStore.get<DailyMetrics>('daily_metrics', docId);
  }

  /**
   * Get daily metrics for a date range
   */
  public async getDailyMetricsRange(
    userId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DailyMetrics[]> {
    const metrics: DailyMetrics[] = [];
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const metric = await this.getDailyMetrics(userId, tenantId, current);
      if (metric) {
        metrics.push(metric);
      }
      current.setDate(current.getDate() + 1);
    }
    
    return metrics;
  }

  /**
   * Get weekly metrics
   */
  public async getWeeklyMetrics(
    userId: string,
    tenantId: string,
    weekStartDate: Date
  ): Promise<WeeklyMetrics | null> {
    const weekStart = this.getWeekStart(weekStartDate);
    const weekStartStr = this.formatDate(weekStart);
    const docId = `${tenantId}_${userId}_${weekStartStr}`;
    
    return this.dataStore.get<WeeklyMetrics>('weekly_metrics', docId);
  }

  /**
   * Calculate user KPIs with trends
   */
  public async calculateKPIs(
    userId: string,
    tenantId: string
  ): Promise<UserKPIs> {
    const today = new Date();
    
    // Current period: last 7 days
    const currentEnd = today;
    const currentStart = new Date(today);
    currentStart.setDate(currentStart.getDate() - 7);
    
    // Previous period: prior 7 days
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 7);
    
    const currentMetrics = await this.getDailyMetricsRange(userId, tenantId, currentStart, currentEnd);
    const previousMetrics = await this.getDailyMetricsRange(userId, tenantId, previousStart, previousEnd);
    
    // Calculate current period stats
    const currentActiveDays = currentMetrics.filter(m => m.totalActivities > 0).length;
    const currentTotalActivities = currentMetrics.reduce((sum, m) => sum + m.totalActivities, 0);
    const currentHabitCompletions = currentMetrics.reduce((sum, m) => sum + m.habitCompletions, 0);
    const currentTotalCalories = currentMetrics.reduce((sum, m) => sum + m.caloriesConsumed, 0);
    const currentTotalWorkoutMinutes = currentMetrics.reduce((sum, m) => sum + m.workoutMinutes, 0);
    const currentTotalSleepHours = currentMetrics.reduce((sum, m) => sum + m.sleepHours, 0);
    
    // Calculate previous period stats
    const previousActiveDays = previousMetrics.filter(m => m.totalActivities > 0).length;
    const previousTotalActivities = previousMetrics.reduce((sum, m) => sum + m.totalActivities, 0);
    const previousHabitCompletions = previousMetrics.reduce((sum, m) => sum + m.habitCompletions, 0);
    const previousTotalCalories = previousMetrics.reduce((sum, m) => sum + m.caloriesConsumed, 0);
    const previousTotalWorkoutMinutes = previousMetrics.reduce((sum, m) => sum + m.workoutMinutes, 0);
    const previousTotalSleepHours = previousMetrics.reduce((sum, m) => sum + m.sleepHours, 0);
    
    // Calculate trends (percentage change)
    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };
    
    return {
      userId,
      tenantId,
      currentPeriod: {
        activeDays: currentActiveDays,
        totalActivities: currentTotalActivities,
        habitCompletionRate: currentHabitCompletions > 0 ? (currentHabitCompletions / 7) * 100 : 0,
        avgDailyCalories: currentActiveDays > 0 ? currentTotalCalories / currentActiveDays : 0,
        avgDailyWorkoutMinutes: currentActiveDays > 0 ? currentTotalWorkoutMinutes / currentActiveDays : 0,
        avgDailySleepHours: currentActiveDays > 0 ? currentTotalSleepHours / currentActiveDays : 0,
      },
      previousPeriod: {
        activeDays: previousActiveDays,
        totalActivities: previousTotalActivities,
        habitCompletionRate: previousHabitCompletions > 0 ? (previousHabitCompletions / 7) * 100 : 0,
        avgDailyCalories: previousActiveDays > 0 ? previousTotalCalories / previousActiveDays : 0,
        avgDailyWorkoutMinutes: previousActiveDays > 0 ? previousTotalWorkoutMinutes / previousActiveDays : 0,
        avgDailySleepHours: previousActiveDays > 0 ? previousTotalSleepHours / previousActiveDays : 0,
      },
      trends: {
        activeDaysTrend: calculateTrend(currentActiveDays, previousActiveDays),
        activityTrend: calculateTrend(currentTotalActivities, previousTotalActivities),
        habitTrend: calculateTrend(currentHabitCompletions, previousHabitCompletions),
        nutritionTrend: calculateTrend(currentTotalCalories, previousTotalCalories),
        workoutTrend: calculateTrend(currentTotalWorkoutMinutes, previousTotalWorkoutMinutes),
        sleepTrend: calculateTrend(currentTotalSleepHours, previousTotalSleepHours),
      },
      allTime: {
        totalActivities: currentTotalActivities, // Simplified - would need full history
        longestStreak: 0, // Would need full history to calculate
        totalXpEarned: 0, // Would integrate with rewards service
        joinedDate: '', // Would come from user profile
      },
      updatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let analyticsServiceInstance: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!analyticsServiceInstance) {
    analyticsServiceInstance = new AnalyticsService();
  }
  return analyticsServiceInstance;
}
