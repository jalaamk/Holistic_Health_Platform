/**
 * Timeline Projection Service
 * 
 * Subscribes to domain events and builds a unified activity timeline.
 * The timeline provides a chronological feed of all user activities across domains.
 */

import { getEventBus } from '../core/event-bus';
import { getDataStore } from '../providers/firebase-datastore';
import { EventEnvelope } from '../providers/interfaces';
import { DataClassification } from '../types';

export interface TimelineItem {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  metadata: Record<string, unknown>;
}

interface TimelineEntry {
  id: string;
  tenantId: string;
  userId: string;
  timestamp: string;
  type: 'habit_completed' | 'meal_logged' | 'workout_logged' | 'sleep_logged' | 'journal_created' | 'mood_logged' | 'mindfulness_logged';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  classification: string;
  createdAt: string;
}

class TimelineProjectionService {
  private initialized = false;

  /**
   * Initialize timeline event subscribers
   */
  initialize(): void {
    if (this.initialized) {
      console.log('[Timeline] Already initialized');
      return;
    }

    const eventBus = getEventBus();

    // Subscribe to all domain events that should appear in timeline
    eventBus.subscribe('habits.completed', this.handleHabitCompleted.bind(this));
    eventBus.subscribe('nutrition.meal.logged', this.handleMealLogged.bind(this));
    eventBus.subscribe('movement.workout.logged', this.handleWorkoutLogged.bind(this));
    eventBus.subscribe('sleep.session.logged', this.handleSleepLogged.bind(this));
    eventBus.subscribe('mind.journal.created', this.handleJournalCreated.bind(this));
    eventBus.subscribe('mind.mood.logged', this.handleMoodLogged.bind(this));
    eventBus.subscribe('mind.mindfulness.logged', this.handleMindfulnessLogged.bind(this));

    this.initialized = true;
    console.log('[Timeline] Event subscribers initialized');
  }

  /**
   * Get timeline for a user
   */
  async getTimeline(userId: string, tenantId: string, limit = 50): Promise<TimelineItem[]> {
    const dataStore = getDataStore();
    const collection = `tenants/${tenantId}/users/${userId}/timeline`;
    
    // In a real implementation, this would query with ordering and limit
    // For now, we'll simulate fetching timeline entries
    const entries: TimelineEntry[] = [];
    
    // Convert to TimelineItem format
    return entries.map(entry => ({
      id: entry.id,
      timestamp: entry.timestamp,
      type: entry.type,
      title: entry.title,
      description: entry.description,
      icon: this.getIconForType(entry.type),
      metadata: entry.metadata,
    }));
  }

  /**
   * Handle habit completion event
   */
  private async handleHabitCompleted(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Timeline] Event missing tenantId, skipping');
        return;
      }
      const { habitId, habitName, notes } = event.data;
      
      await this.addTimelineEntry({
        tenantId: event.tenantId,
        userId: event.userId,
        timestamp: event.occurredAt,
        type: 'habit_completed',
        title: `Completed: ${habitName}`,
        description: notes || 'Habit completed successfully',
        metadata: { habitId, eventId: event.eventId },
        classification: event.classification,
      });

      console.log(`[Timeline] Added habit completion: ${habitName}`);
    } catch (error) {
      console.error('[Timeline] Error handling habit completion:', error);
      throw error;
    }
  }

  /**
   * Handle meal logged event
   */
  private async handleMealLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Timeline] Event missing tenantId, skipping');
        return;
      }
      const { mealId, name, mealType, calories } = event.data;
      
      await this.addTimelineEntry({
        tenantId: event.tenantId,
        userId: event.userId,
        timestamp: event.occurredAt,
        type: 'meal_logged',
        title: `Logged ${mealType}: ${name}`,
        description: `${calories} calories`,
        metadata: { mealId, mealType, calories, eventId: event.eventId },
        classification: event.classification,
      });

      console.log(`[Timeline] Added meal: ${name}`);
    } catch (error) {
      console.error('[Timeline] Error handling meal logged:', error);
      throw error;
    }
  }

  /**
   * Handle workout logged event
   */
  private async handleWorkoutLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Timeline] Event missing tenantId, skipping');
        return;
      }
      const { workoutId, name, type, duration, caloriesBurned } = event.data;
      
      await this.addTimelineEntry({
        tenantId: event.tenantId,
        userId: event.userId,
        timestamp: event.occurredAt,
        type: 'workout_logged',
        title: `${type} workout: ${name}`,
        description: `${duration} minutes, ${caloriesBurned} calories burned`,
        metadata: { workoutId, type, duration, caloriesBurned, eventId: event.eventId },
        classification: event.classification,
      });

      console.log(`[Timeline] Added workout: ${name}`);
    } catch (error) {
      console.error('[Timeline] Error handling workout logged:', error);
      throw error;
    }
  }

  /**
   * Handle sleep logged event
   */
  private async handleSleepLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Timeline] Event missing tenantId, skipping');
        return;
      }
      const { sessionId, duration, quality } = event.data;
      
      await this.addTimelineEntry({
        tenantId: event.tenantId,
        userId: event.userId,
        timestamp: event.occurredAt,
        type: 'sleep_logged',
        title: 'Sleep session logged',
        description: `${duration} hours, quality: ${quality}/5`,
        metadata: { sessionId, duration, quality, eventId: event.eventId },
        classification: event.classification,
      });

      console.log(`[Timeline] Added sleep session: ${duration}h`);
    } catch (error) {
      console.error('[Timeline] Error handling sleep logged:', error);
      throw error;
    }
  }

  /**
   * Handle journal created event
   */
  private async handleJournalCreated(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Timeline] Event missing tenantId, skipping');
        return;
      }
      const { entryId, title, mood } = event.data;
      
      await this.addTimelineEntry({
        tenantId: event.tenantId,
        userId: event.userId,
        timestamp: event.occurredAt,
        type: 'journal_created',
        title: `Journal entry: ${title}`,
        description: mood ? `Mood: ${mood}` : 'New journal entry',
        metadata: { entryId, mood, eventId: event.eventId },
        classification: event.classification,
      });

      console.log(`[Timeline] Added journal entry: ${title}`);
    } catch (error) {
      console.error('[Timeline] Error handling journal created:', error);
      throw error;
    }
  }

  /**
   * Handle mood logged event
   */
  private async handleMoodLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Timeline] Event missing tenantId, skipping');
        return;
      }
      const { mood, intensity } = event.data;
      
      await this.addTimelineEntry({
        tenantId: event.tenantId,
        userId: event.userId,
        timestamp: event.occurredAt,
        type: 'mood_logged',
        title: `Mood: ${mood}`,
        description: `Intensity: ${intensity}/5`,
        metadata: { mood, intensity, eventId: event.eventId },
        classification: event.classification,
      });

      console.log(`[Timeline] Added mood: ${mood}`);
    } catch (error) {
      console.error('[Timeline] Error handling mood logged:', error);
      throw error;
    }
  }

  /**
   * Handle mindfulness logged event
   */
  private async handleMindfulnessLogged(event: EventEnvelope<any>): Promise<void> {
    try {
      if (!event.tenantId) {
        console.warn('[Timeline] Event missing tenantId, skipping');
        return;
      }
      const { type, duration } = event.data;
      
      await this.addTimelineEntry({
        tenantId: event.tenantId,
        userId: event.userId,
        timestamp: event.occurredAt,
        type: 'mindfulness_logged',
        title: `${type} session`,
        description: `${duration} minutes`,
        metadata: { type, duration, eventId: event.eventId },
        classification: event.classification,
      });

      console.log(`[Timeline] Added mindfulness: ${type}`);
    } catch (error) {
      console.error('[Timeline] Error handling mindfulness logged:', error);
      throw error;
    }
  }

  /**
   * Add entry to timeline
   */
  private async addTimelineEntry(entry: Omit<TimelineEntry, 'id' | 'createdAt'>): Promise<void> {
    const dataStore = getDataStore();
    const collection = `tenants/${entry.tenantId}/users/${entry.userId}/timeline`;
    
    const timelineEntry: TimelineEntry = {
      ...entry,
      id: `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    await dataStore.create(collection, timelineEntry.id, timelineEntry);
  }

  /**
   * Get icon for timeline item type
   */
  private getIconForType(type: TimelineEntry['type']): string {
    const icons: Record<TimelineEntry['type'], string> = {
      'habit_completed': '✓',
      'meal_logged': '🍽️',
      'workout_logged': '💪',
      'sleep_logged': '😴',
      'journal_created': '📝',
      'mood_logged': '😊',
      'mindfulness_logged': '🧘',
    };
    return icons[type] || '•';
  }
}

// Singleton instance
let timelineService: TimelineProjectionService | null = null;

export function getTimelineService(): TimelineProjectionService {
  if (!timelineService) {
    timelineService = new TimelineProjectionService();
  }
  return timelineService;
}
