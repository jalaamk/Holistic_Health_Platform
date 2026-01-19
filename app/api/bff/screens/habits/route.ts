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
import { getHabitsService } from '@/packages/domains/habits';

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

  // Fetch real data from Habits domain
  const habitsService = getHabitsService();
  
  // Get all active habits for user
  const habits = await habitsService.listHabits(context.tenantId, context.userId, true);
  
  // Get today's completions
  const todayCompletions = await habitsService.getTodayCompletions(
    context.userId,
    context.tenantId
  );
  const completionMap = new Map(todayCompletions.map(c => [c.habitId, c]));
  
  // Calculate stats for each habit
  const habitsWithStats = await Promise.all(
    habits.map(async (habit) => {
      const stats = await habitsService.calculateStats(habit.id, context.tenantId);
      const completion = completionMap.get(habit.id);
      
      return {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        category: habit.category.charAt(0).toUpperCase() + habit.category.slice(1),
        targetFrequency: habit.targetFrequency,
        completed: !!completion,
        completedAt: completion?.completedAt,
        streak: stats.currentStreak,
        stats,
      };
    })
  );

  // Calculate weekly progress
  const totalHabitsPerWeek = habits.length * 7;
  const weeklyCompletions = habitsWithStats.reduce((sum, h) => {
    // Estimate based on completion rate
    return sum + Math.round((h.stats.completionRate / 100) * 7);
  }, 0);
  const weeklyCompletionRate = totalHabitsPerWeek > 0 
    ? Math.round((weeklyCompletions / totalHabitsPerWeek) * 100) 
    : 0;

  // Aggregate by category
  const categoryMap = new Map<string, { count: number; totalRate: number }>();
  habitsWithStats.forEach(h => {
    const existing = categoryMap.get(h.category) || { count: 0, totalRate: 0 };
    categoryMap.set(h.category, {
      count: existing.count + 1,
      totalRate: existing.totalRate + h.stats.completionRate,
    });
  });
  
  const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    completionRate: Math.round(data.totalRate / data.count),
  }));

  // Find best streak
  const bestHabit = habitsWithStats.reduce((best, current) => 
    current.streak > best.streak ? current : best
  , habitsWithStats[0] || { name: 'None', streak: 0 });

  // Generate insights
  const insights: HabitsViewModel['insights'] = [];
  const completedToday = habitsWithStats.filter(h => h.completed).length;
  
  if (completedToday === habits.length && habits.length > 0) {
    insights.push({
      message: `Perfect! You've completed all ${habits.length} habits today.`,
      type: 'success',
    });
  } else if (completedToday > 0) {
    insights.push({
      message: `Great progress! ${completedToday} of ${habits.length} habits completed today.`,
      type: 'success',
    });
  }

  if (bestHabit && bestHabit.streak >= 7) {
    insights.push({
      message: `Your "${bestHabit.name}" habit has a ${bestHabit.streak}-day streak!`,
      type: 'success',
    });
  }

  const incompleteToday = habitsWithStats.filter(h => !h.completed);
  if (incompleteToday.length > 0) {
    insights.push({
      message: `${incompleteToday.length} habit${incompleteToday.length > 1 ? 's' : ''} remaining for today.`,
      type: 'info',
      actionable: 'Complete your habits',
    });
  }

  const viewModel: HabitsViewModel = {
    profile: {
      displayName: 'User', // TODO: Get from Profile Spine
      streakDays: bestHabit?.streak || 0,
    },
    todayHabits: habitsWithStats.map(h => ({
      id: h.id,
      name: h.name,
      description: h.description,
      category: h.category,
      targetFrequency: h.targetFrequency,
      completed: h.completed,
      completedAt: h.completedAt,
      streak: h.streak,
    })),
    weeklyProgress: {
      totalHabits: totalHabitsPerWeek,
      completedCount: weeklyCompletions,
      completionRate: weeklyCompletionRate,
      trend: weeklyCompletionRate >= 75 ? 'up' : weeklyCompletionRate >= 50 ? 'stable' : 'down',
    },
    categories,
    insights,
    bestStreak: {
      habitName: bestHabit?.name || 'None',
      days: bestHabit?.streak || 0,
    },
  };

  return viewModel;
}

// Export route handler
export const GET = createApiHandler({
  auth: true,
  handler,
});
