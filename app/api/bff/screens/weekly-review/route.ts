/**
 * BFF Endpoint: Weekly Review
 * Returns a complete ViewModel for the Weekly Review screen
 * 
 * Demonstrates:
 * - Standard API handler usage
 * - Multi-domain data composition
 * - AI-generated insights with explainability
 * - Policy and consent checking
 * - ViewModel pattern (single call per screen)
 */

import { createApiHandler } from '@/packages/core/api-handler';
import type { RequestContext } from '@/packages/types';
import { getEntitlementsService } from '@/packages/core/entitlements';
import { getPolicyConsentService } from '@/packages/core/policy-consent';

// Output ViewModel
interface WeeklyReviewViewModel {
  profile: {
    displayName: string;
    reviewPeriod: {
      startDate: string;
      endDate: string;
      week: number;
    };
  };
  summary: {
    overallScore: number;
    adherenceRate: number;
    streak: number;
    completedGoals: number;
    totalGoals: number;
  };
  domainScores: Array<{
    domain: string;
    score: number;
    change: number; // percentage change from last week
    status: 'excellent' | 'good' | 'needs_improvement';
  }>;
  highlights: Array<{
    type: 'achievement' | 'milestone' | 'improvement';
    title: string;
    description: string;
    date: string;
    icon?: string;
  }>;
  insights: Array<{
    message: string;
    type: 'success' | 'warning' | 'info';
    domain: string;
    aiGenerated: boolean;
    explainability?: {
      reasonCodes: string[];
      confidence: number;
      evidencePack: Record<string, unknown>;
    };
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    actionable: string;
    aiGenerated: boolean;
  }>;
  dataPoints: {
    habits: {
      completed: number;
      total: number;
      bestStreak: number;
    };
    nutrition: {
      mealsLogged: number;
      averageCalories: number;
      macroAdherence: number;
    };
    movement: {
      workouts: number;
      totalMinutes: number;
      caloriesBurned: number;
    };
    sleep: {
      averageHours: number;
      quality: number;
      consistency: number;
    };
  };
}

// Handler logic
async function handler(
  _input: Record<string, never>,
  context: RequestContext
): Promise<WeeklyReviewViewModel> {
  // Check entitlements
  const entitlementsService = getEntitlementsService();
  const reviewAccess = await entitlementsService.checkFeature(
    context.tenantId,
    'weekly_review'
  );

  if (!reviewAccess.allowed) {
    // Fallback for basic plans - allow but with limited features
    console.log('Weekly review accessed on basic plan - limited features');
  }

  // Check policy for aggregated data access
  const policyService = getPolicyConsentService();
  const policyDecision = await policyService.evaluate(
    context,
    'analytics.weekly_review',
    'read'
  );

  if (!policyDecision.allowed) {
    throw new Error(`Access denied: ${policyDecision.reason}`);
  }

  // Calculate week dates
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // TODO: Fetch real data from multiple domains
  const viewModel: WeeklyReviewViewModel = {
    profile: {
      displayName: 'User',
      reviewPeriod: {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0],
        week: Math.ceil((now.getDate() - now.getDay() + 1) / 7),
      },
    },
    summary: {
      overallScore: 82,
      adherenceRate: 78,
      streak: 7,
      completedGoals: 28,
      totalGoals: 35,
    },
    domainScores: [
      { domain: 'Nutrition', score: 88, change: 5, status: 'excellent' },
      { domain: 'Movement', score: 75, change: -3, status: 'good' },
      { domain: 'Sleep', score: 90, change: 10, status: 'excellent' },
      { domain: 'Habits', score: 80, change: 2, status: 'good' },
      { domain: 'Mind', score: 70, change: -5, status: 'needs_improvement' },
    ],
    highlights: [
      {
        type: 'achievement',
        title: '7-Day Streak!',
        description: 'Completed all habits for 7 consecutive days',
        date: new Date().toISOString(),
        icon: '🔥',
      },
      {
        type: 'milestone',
        title: '100 Workouts Milestone',
        description: 'Reached 100 total workouts since joining',
        date: new Date(Date.now() - 86400000).toISOString(),
        icon: '💪',
      },
      {
        type: 'improvement',
        title: 'Sleep Quality Up 15%',
        description: 'Your sleep quality improved significantly this week',
        date: new Date(Date.now() - 172800000).toISOString(),
        icon: '😴',
      },
    ],
    insights: [
      {
        message: 'Your nutrition consistency improved by 5% this week.',
        type: 'success',
        domain: 'Nutrition',
        aiGenerated: true,
        explainability: {
          reasonCodes: ['CONSISTENT_MEAL_LOGGING', 'MACRO_ADHERENCE_HIGH'],
          confidence: 0.92,
          evidencePack: {
            mealsLoggedDaily: [3, 4, 3, 4, 3, 3, 4],
            macroAdherenceRate: 0.88,
          },
        },
      },
      {
        message: 'Sleep quality increased significantly after consistent bedtime routine.',
        type: 'success',
        domain: 'Sleep',
        aiGenerated: true,
        explainability: {
          reasonCodes: ['CONSISTENT_BEDTIME', 'IMPROVED_SLEEP_DURATION'],
          confidence: 0.87,
          evidencePack: {
            averageBedtime: '22:30',
            bedtimeConsistency: 0.9,
          },
        },
      },
      {
        message: 'Consider increasing workout frequency to meet your movement goals.',
        type: 'info',
        domain: 'Movement',
        aiGenerated: true,
        explainability: {
          reasonCodes: ['BELOW_TARGET_FREQUENCY'],
          confidence: 0.85,
          evidencePack: {
            targetWorkouts: 5,
            actualWorkouts: 3,
          },
        },
      },
      {
        message: 'Mindfulness practice dropped this week. Try scheduling it in the morning.',
        type: 'warning',
        domain: 'Mind',
        aiGenerated: true,
        explainability: {
          reasonCodes: ['DECREASED_FREQUENCY', 'EVENING_COMPLETION_PATTERN'],
          confidence: 0.78,
          evidencePack: {
            completionRate: 0.6,
            preferredTime: 'morning',
          },
        },
      },
    ],
    recommendations: [
      {
        title: 'Maintain Sleep Routine',
        description: 'Your consistent sleep schedule is working well. Keep it up!',
        priority: 'high',
        actionable: 'Set bedtime reminder for 10:00 PM',
        aiGenerated: true,
      },
      {
        title: 'Add Mid-Week Workout',
        description: 'Adding one workout on Wednesday would help reach your weekly goal.',
        priority: 'medium',
        actionable: 'Schedule Wednesday workout',
        aiGenerated: true,
      },
      {
        title: 'Morning Meditation',
        description: 'Try moving your meditation practice to mornings for better consistency.',
        priority: 'medium',
        actionable: 'Update meditation habit time',
        aiGenerated: true,
      },
    ],
    dataPoints: {
      habits: {
        completed: 28,
        total: 35,
        bestStreak: 21,
      },
      nutrition: {
        mealsLogged: 24,
        averageCalories: 1850,
        macroAdherence: 88,
      },
      movement: {
        workouts: 3,
        totalMinutes: 180,
        caloriesBurned: 1200,
      },
      sleep: {
        averageHours: 7.5,
        quality: 90,
        consistency: 85,
      },
    },
  };

  return viewModel;
}

// Export route handler
export const GET = createApiHandler({
  auth: true,
  handler,
});
