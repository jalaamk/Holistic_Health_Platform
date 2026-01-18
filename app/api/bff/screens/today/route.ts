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

  // Build ViewModel
  // TODO: Fetch real data from domains
  const viewModel: TodayViewModel = {
    profile: {
      displayName: 'User',
      greeting,
    },
    plan: {
      itemsDue: 3,
      items: [
        {
          id: '1',
          title: 'Morning meditation',
          type: 'habit',
          dueAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Log breakfast',
          type: 'nutrition',
          dueAt: new Date().toISOString(),
        },
        {
          id: '3',
          title: 'Evening walk',
          type: 'movement',
          dueAt: new Date().toISOString(),
        },
      ],
    },
    habits: {
      completed: 2,
      total: 5,
      items: [
        { id: '1', name: 'Morning meditation', completed: true },
        { id: '2', name: 'Drink water', completed: true },
        { id: '3', name: 'Exercise', completed: false },
        { id: '4', name: 'Journal', completed: false },
        { id: '5', name: 'Read', completed: false },
      ],
    },
    timeline: [
      {
        id: '1',
        type: 'habit.completed',
        title: 'Completed morning meditation',
        occurredAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '2',
        type: 'nutrition.meal.logged',
        title: 'Logged breakfast',
        occurredAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    rewards: {
      streak: 7,
      xp: 2450,
      level: 5,
    },
    notifications: {
      unread: 2,
    },
  };

  return viewModel;
}

// Export route handler
export const GET = createApiHandler({
  auth: true,
  handler,
});
