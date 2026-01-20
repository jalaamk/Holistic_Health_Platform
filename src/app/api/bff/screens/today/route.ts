/**
 * Today Screen BFF Endpoint
 * Returns all data needed to render the Today screen
 */

import { createHandler } from '@/packages/core/src/utils/handler';

interface TodayViewModel {
  profile: {
    userId: string;
    displayName: string;
    timezone: string;
  };
  planItems: Array<{
    id: string;
    title: string;
    dueAt: string;
    completed: boolean;
  }>;
  habits: Array<{
    id: string;
    name: string;
    completed: boolean;
    streak: number;
  }>;
  timeline: Array<{
    id: string;
    type: string;
    timestamp: string;
    content: Record<string, unknown>;
  }>;
  rewards: {
    points: number;
    level: number;
    streaks: Array<Record<string, unknown>>;
  };
  notifications: {
    unreadCount: number;
    recent: Array<Record<string, unknown>>;
  };
}

export const GET = createHandler<void, TodayViewModel>({
  method: 'GET',
  requireAuth: true,
  requireEntitlement: 'habits',
  handler: async (_, context) => {
    // TODO: Fetch real data from Profile Spine, Plan OS, Habits OS, etc.
    // This is a minimal implementation demonstrating the BFF pattern
    
    return {
      profile: {
        userId: context.userId,
        displayName: 'Demo User',
        timezone: 'America/New_York',
      },
      planItems: [
        {
          id: 'plan-1',
          title: 'Morning meditation',
          dueAt: new Date().toISOString(),
          completed: false,
        },
        {
          id: 'plan-2',
          title: 'Log breakfast',
          dueAt: new Date().toISOString(),
          completed: true,
        },
      ],
      habits: [
        {
          id: 'habit-1',
          name: 'Drink water',
          completed: true,
          streak: 7,
        },
        {
          id: 'habit-2',
          name: 'Exercise',
          completed: false,
          streak: 3,
        },
      ],
      timeline: [
        {
          id: 'timeline-1',
          type: 'habit.completed',
          timestamp: new Date().toISOString(),
          content: {
            habitName: 'Drink water',
          },
        },
      ],
      rewards: {
        points: 250,
        level: 5,
        streaks: [],
      },
      notifications: {
        unreadCount: 2,
        recent: [],
      },
    };
  },
});
