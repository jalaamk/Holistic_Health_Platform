/**
 * BFF Endpoint: Habits Dashboard
 * Returns a complete ViewModel for the Habits screen
 * 
 * Demonstrates:
 * - Standard API handler usage
 * - Request context propagation
 * - Entitlements checking
 * - Policy evaluation for data access
 * - ViewModel pattern (single call per screen)
 */

import { createApiHandler } from '@/packages/core/api-handler';
import type { RequestContext } from '@/packages/types';
import { getEntitlementsService } from '@/packages/core/entitlements';
import { getPolicyConsentService } from '@/packages/core/policy-consent';

// Output ViewModel
interface HabitsViewModel {
  profile: {
    displayName: string;
    streakDays: number;
  };
  todayHabits: Array<{
    id: string;
    name: string;
    description?: string;
    category: string;
    targetFrequency: string;
    completed: boolean;
    completedAt?: string;
    streak: number;
  }>;
  weeklyProgress: {
    totalHabits: number;
    completedCount: number;
    completionRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  categories: Array<{
    name: string;
    count: number;
    completionRate: number;
  }>;
  insights: {
    message: string;
    type: 'success' | 'warning' | 'info';
    actionable?: string;
  }[];
  bestStreak: {
    habitName: string;
    days: number;
  };
}

// Handler logic
async function handler(
  _input: Record<string, never>,
  context: RequestContext
): Promise<HabitsViewModel> {
  // Check entitlements
  const entitlementsService = getEntitlementsService();
  const habitsAccess = await entitlementsService.checkFeature(
    context.tenantId,
    'habits'
  );

  if (!habitsAccess.allowed) {
    throw new Error('Habits feature not available on your plan');
  }

  // Check policy for habits data access
  const policyService = getPolicyConsentService();
  const policyDecision = await policyService.evaluate(
    context,
    'habits.data',
    'read'
  );

  if (!policyDecision.allowed) {
    throw new Error(`Access denied: ${policyDecision.reason}`);
  }

  // TODO: Fetch real data from Habits domain
  const viewModel: HabitsViewModel = {
    profile: {
      displayName: 'User',
      streakDays: 7,
    },
    todayHabits: [
      {
        id: '1',
        name: 'Morning Meditation',
        description: '10 minutes of mindfulness',
        category: 'Mind',
        targetFrequency: 'daily',
        completed: true,
        completedAt: new Date(Date.now() - 7200000).toISOString(),
        streak: 14,
      },
      {
        id: '2',
        name: 'Drink 8 glasses of water',
        category: 'Nutrition',
        targetFrequency: 'daily',
        completed: true,
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        streak: 21,
      },
      {
        id: '3',
        name: 'Exercise 30 minutes',
        description: 'Cardio or strength training',
        category: 'Movement',
        targetFrequency: 'daily',
        completed: false,
        streak: 5,
      },
      {
        id: '4',
        name: 'Evening journal',
        category: 'Mind',
        targetFrequency: 'daily',
        completed: false,
        streak: 10,
      },
      {
        id: '5',
        name: 'Read for 20 minutes',
        category: 'Learning',
        targetFrequency: 'daily',
        completed: false,
        streak: 3,
      },
    ],
    weeklyProgress: {
      totalHabits: 35, // 5 habits × 7 days
      completedCount: 28,
      completionRate: 80, // (28/35) * 100
      trend: 'up',
    },
    categories: [
      { name: 'Mind', count: 2, completionRate: 85 },
      { name: 'Nutrition', count: 1, completionRate: 100 },
      { name: 'Movement', count: 1, completionRate: 70 },
      { name: 'Learning', count: 1, completionRate: 60 },
    ],
    insights: [
      {
        message: 'Great job! You\'re on a 7-day streak across all habits.',
        type: 'success',
      },
      {
        message: 'Your water intake habit has a 21-day streak - keep it up!',
        type: 'success',
      },
      {
        message: 'Consider completing your exercise habit to maintain momentum.',
        type: 'info',
        actionable: 'Log your workout now',
      },
    ],
    bestStreak: {
      habitName: 'Drink 8 glasses of water',
      days: 21,
    },
  };

  return viewModel;
}

// Export route handler
export const GET = createApiHandler({
  auth: true,
  handler,
});
