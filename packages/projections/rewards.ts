/**
 * Rewards Projection Service
 * 
 * Subscribes to domain events and calculates rewards, achievements, and gamification metrics.
 * Tracks streaks, XP, levels, and unlocked achievements.
 */

import { getEventBus } from '../core/event-bus';
import { getDataStore } from '../providers/firebase-datastore';
import { EventEnvelope } from '../providers/interfaces';

interface RewardsState {
  userId: string;
  tenantId: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  achievements: Achievement[];
  lastActivityDate: string;
  updatedAt: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
  category: 'habits' | 'nutrition' | 'sleep' | 'movement' | 'mind' | 'general';
}

class RewardsProjectionService {
  private initialized = false;
  private readonly XP_PER_LEVEL = 1000;
  private readonly XP_VALUES = {
    habitCompleted: 10,
    mealLogged: 5,
    workoutLogged: 20,
    sleepLogged: 15,
    journalCreated: 10,
    moodLogged: 5,
    mindfulnessLogged: 15,
  };

  /**
   * Initialize rewards event subscribers
   */
  initialize(): void {
    if (this.initialized) {
      console.log('[Rewards] Already initialized');
      return;
    }

    const eventBus = getEventBus();

    // Subscribe to events that grant XP
    eventBus.subscribe('habits.completed', this.handleHabitCompleted.bind(this));
    eventBus.subscribe('nutrition.meal.logged', this.handleMealLogged.bind(this));
    eventBus.subscribe('movement.workout.logged', this.handleWorkoutLogged.bind(this));
    eventBus.subscribe('sleep.session.logged', this.handleSleepLogged.bind(this));
    eventBus.subscribe('mind.journal.created', this.handleJournalCreated.bind(this));
    eventBus.subscribe('mind.mood.logged', this.handleMoodLogged.bind(this));
    eventBus.subscribe('mind.mindfulness.logged', this.handleMindfulnessLogged.bind(this));

    this.initialized = true;
    console.log('[Rewards] Event subscribers initialized');
  }

  /**
   * Get rewards state for a user
   */
  async getRewardsState(userId: string, tenantId: string): Promise<RewardsState> {
    const dataStore = getDataStore();
    const docId = `${tenantId}_${userId}`;
    
    let state = await dataStore.get<RewardsState>('rewards_states', docId);
    
    if (!state) {
      // Initialize new rewards state
      state = {
        userId,
        tenantId,
        xp: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        achievements: [],
        lastActivityDate: '',
        updatedAt: new Date().toISOString(),
      };
      await dataStore.create('rewards_states', docId, state);
    }
    
    return state;
  }

  /**
   * Award XP and check for level ups and achievements
   */
  private async awardXP(
    userId: string,
    tenantId: string,
    xpAmount: number,
    activityType: string
  ): Promise<void> {
    const state = await this.getRewardsState(userId, tenantId);
    const dataStore = getDataStore();
    const docId = `${tenantId}_${userId}`;

    // Add XP
    state.xp += xpAmount;

    // Calculate level
    const newLevel = Math.floor(state.xp / this.XP_PER_LEVEL) + 1;
    const leveledUp = newLevel > state.level;
    state.level = newLevel;

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (!state.lastActivityDate || state.lastActivityDate === yesterday) {
      state.currentStreak++;
      if (state.currentStreak > state.longestStreak) {
        state.longestStreak = state.currentStreak;
      }
    } else if (state.lastActivityDate !== today) {
      state.currentStreak = 1;
    }
    
    state.lastActivityDate = today;
    state.updatedAt = new Date().toISOString();

    // Check for achievements
    const newAchievements = this.checkAchievements(state, activityType);
    state.achievements.push(...newAchievements);

    // Save state
    await dataStore.update('rewards_states', docId, state);

    console.log(`[Rewards] ${userId}: +${xpAmount} XP (${activityType}), Level ${state.level}, Streak ${state.currentStreak}`);
    
    if (leveledUp) {
      console.log(`[Rewards] ${userId}: LEVEL UP! Now level ${state.level}`);
    }
    
    if (newAchievements.length > 0) {
      console.log(`[Rewards] ${userId}: Unlocked ${newAchievements.length} achievement(s)`);
    }
  }

  /**
   * Check for unlocked achievements
   */
  private checkAchievements(state: RewardsState, activityType: string): Achievement[] {
    const achievements: Achievement[] = [];
    const existingIds = new Set(state.achievements.map(a => a.id));

    // Streak achievements
    if (state.currentStreak === 7 && !existingIds.has('streak_7')) {
      achievements.push({
        id: 'streak_7',
        name: 'Week Warrior',
        description: '7-day streak',
        icon: '🔥',
        unlockedAt: new Date().toISOString(),
        category: 'general',
      });
    }
    
    if (state.currentStreak === 30 && !existingIds.has('streak_30')) {
      achievements.push({
        id: 'streak_30',
        name: 'Month Master',
        description: '30-day streak',
        icon: '🏆',
        unlockedAt: new Date().toISOString(),
        category: 'general',
      });
    }

    // Level achievements
    if (state.level === 5 && !existingIds.has('level_5')) {
      achievements.push({
        id: 'level_5',
        name: 'Rising Star',
        description: 'Reached level 5',
        icon: '⭐',
        unlockedAt: new Date().toISOString(),
        category: 'general',
      });
    }
    
    if (state.level === 10 && !existingIds.has('level_10')) {
      achievements.push({
        id: 'level_10',
        name: 'Wellness Champion',
        description: 'Reached level 10',
        icon: '👑',
        unlockedAt: new Date().toISOString(),
        category: 'general',
      });
    }

    // First activity achievements (based on activity type)
    const firstActivityAchievements: Record<string, { id: string; name: string; description: string; icon: string; category: Achievement['category'] }> = {
      'habit': { id: 'first_habit', name: 'Habit Former', description: 'Completed first habit', icon: '✓', category: 'habits' },
      'meal': { id: 'first_meal', name: 'Food Logger', description: 'Logged first meal', icon: '🍽️', category: 'nutrition' },
      'workout': { id: 'first_workout', name: 'Fitness Starter', description: 'Logged first workout', icon: '💪', category: 'movement' },
      'sleep': { id: 'first_sleep', name: 'Sleep Tracker', description: 'Logged first sleep session', icon: '😴', category: 'sleep' },
      'journal': { id: 'first_journal', name: 'Reflection Begins', description: 'Created first journal entry', icon: '📝', category: 'mind' },
    };

    const activityKey = activityType.replace('Completed', '').replace('Logged', '').replace('Created', '').toLowerCase();
    const firstAchievement = firstActivityAchievements[activityKey];
    
    if (firstAchievement && !existingIds.has(firstAchievement.id)) {
      achievements.push({
        ...firstAchievement,
        unlockedAt: new Date().toISOString(),
      });
    }

    return achievements;
  }

  /**
   * Event handlers
   */
  private async handleHabitCompleted(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Rewards] Event missing tenantId, skipping');
        return;
      }
      await this.awardXP(
        event.userId,
        event.tenantId,
        this.XP_VALUES.habitCompleted,
        'habitCompleted'
      );
    } catch (error) {
      console.error('[Rewards] Error handling habit completed:', error);
      throw error;
    }
  }

  private async handleMealLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Rewards] Event missing tenantId, skipping');
        return;
      }
      await this.awardXP(
        event.userId,
        event.tenantId,
        this.XP_VALUES.mealLogged,
        'mealLogged'
      );
    } catch (error) {
      console.error('[Rewards] Error handling meal logged:', error);
      throw error;
    }
  }

  private async handleWorkoutLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Rewards] Event missing tenantId, skipping');
        return;
      }
      await this.awardXP(
        event.userId,
        event.tenantId,
        this.XP_VALUES.workoutLogged,
        'workoutLogged'
      );
    } catch (error) {
      console.error('[Rewards] Error handling workout logged:', error);
      throw error;
    }
  }

  private async handleSleepLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Rewards] Event missing tenantId, skipping');
        return;
      }
      await this.awardXP(
        event.userId,
        event.tenantId,
        this.XP_VALUES.sleepLogged,
        'sleepLogged'
      );
    } catch (error) {
      console.error('[Rewards] Error handling sleep logged:', error);
      throw error;
    }
  }

  private async handleJournalCreated(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Rewards] Event missing tenantId, skipping');
        return;
      }
      await this.awardXP(
        event.userId,
        event.tenantId,
        this.XP_VALUES.journalCreated,
        'journalCreated'
      );
    } catch (error) {
      console.error('[Rewards] Error handling journal created:', error);
      throw error;
    }
  }

  private async handleMoodLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Rewards] Event missing tenantId, skipping');
        return;
      }
      await this.awardXP(
        event.userId,
        event.tenantId,
        this.XP_VALUES.moodLogged,
        'moodLogged'
      );
    } catch (error) {
      console.error('[Rewards] Error handling mood logged:', error);
      throw error;
    }
  }

  private async handleMindfulnessLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Rewards] Event missing tenantId, skipping');
        return;
      }
      await this.awardXP(
        event.userId,
        event.tenantId,
        this.XP_VALUES.mindfulnessLogged,
        'mindfulnessLogged'
      );
    } catch (error) {
      console.error('[Rewards] Error handling mindfulness logged:', error);
      throw error;
    }
  }
}

// Singleton instance
let rewardsService: RewardsProjectionService | null = null;

export function getRewardsService(): RewardsProjectionService {
  if (!rewardsService) {
    rewardsService = new RewardsProjectionService();
  }
  return rewardsService;
}
