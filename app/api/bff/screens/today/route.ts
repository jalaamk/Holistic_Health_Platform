/**
 * BFF Endpoint: Today Screen
 * Returns a complete ViewModel for the Today screen
 * 
 * Demonstrates:
 * - Standard API handler usage
 * - Request context propagation
 * - Entitlements checking
 * - ViewModel pattern (single call per screen)
 */

import { createApiHandler } from '@/packages/core/api-handler';
import type { RequestContext } from '@/packages/types';
import { getEntitlementsService } from '@/packages/core/entitlements';
import { getHabitsService } from '@/packages/domains/habits';
import { getTimelineService } from '@/packages/projections/timeline';
import { getRewardsService } from '@/packages/projections/rewards';

// Output ViewModel
interface TodayViewModel {
  profile: {
    displayName: string;
    greeting: string;
  };
  plan: {
    itemsDue: number;
    items: Array<{
      id: string;
      title: string;
      type: string;
      dueAt: string;
    }>;
  };
  habits: {
    completed: number;
    total: number;
    items: Array<{
      id: string;
      name: string;
      completed: boolean;
    }>;
  };
  timeline: Array<{
    id: string;
    type: string;
    title: string;
    occurredAt: string;
  }>;
  rewards: {
    streak: number;
    xp: number;
    level: number;
  };
  notifications: {
    unread: number;
  };
}

// Handler logic
async function handler(
  _input: Record<string, never>,
  context: RequestContext
): Promise<TodayViewModel> {
  // Check entitlements
  const entitlementsService = getEntitlementsService();
  const nutritionAccess = await entitlementsService.checkFeature(
    context.tenantId,
    'nutrition'
  );

  if (!nutritionAccess.allowed) {
    throw new Error('Nutrition feature not available on your plan');
  }

  // Get current hour for greeting
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17) {
    greeting = 'Good evening';
  }

  // Fetch real data from services
  const habitsService = getHabitsService();
  const timelineService = getTimelineService();
  const rewardsService = getRewardsService();

  // Get today's habits
  const habits = await habitsService.listHabits(context.userId, context.tenantId);
  const todayCompletions = await habitsService.getTodayCompletions(context.userId, context.tenantId);
  const completedIds = new Set(todayCompletions.map(c => c.habitId));

  // Get timeline (last 10 items)
  const timeline = await timelineService.getTimeline(context.userId, context.tenantId, 10);

  // Get rewards state
  const rewardsState = await rewardsService.getRewardsState(context.userId, context.tenantId);

  // Build ViewModel
  const viewModel: TodayViewModel = {
    profile: {
      displayName: 'User', // TODO: Get from Profile Spine
      greeting,
    },
    plan: {
      itemsDue: habits.filter(h => !completedIds.has(h.id)).length,
      items: habits
        .filter(h => !completedIds.has(h.id))
        .slice(0, 5)
        .map(h => ({
          id: h.id,
          title: h.name,
          type: 'habit',
          dueAt: new Date().toISOString(),
        })),
    },
    habits: {
      completed: todayCompletions.length,
      total: habits.length,
      items: habits.slice(0, 5).map(h => ({
        id: h.id,
        name: h.name,
        completed: completedIds.has(h.id),
      })),
    },
    timeline: timeline.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      occurredAt: item.timestamp,
    })),
    rewards: {
      streak: rewardsState.currentStreak,
      xp: rewardsState.xp,
      level: rewardsState.level,
    },
    notifications: {
      unread: 0, // TODO: Implement notification service
    },
  };

  return viewModel;
}

// Export route handler
export const GET = createApiHandler({
  auth: true,
  handler,
});
