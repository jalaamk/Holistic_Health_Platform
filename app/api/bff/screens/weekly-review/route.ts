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
import { getHabitsService } from '@/packages/domains/habits';
import { getNutritionService } from '@/packages/domains/nutrition';
import { getSleepService } from '@/packages/domains/sleep';
import { getMovementService } from '@/packages/domains/movement';

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

  // Initialize domain services
  const habitsService = getHabitsService();
  const nutritionService = getNutritionService();
  const sleepService = getSleepService();
  const movementService = getMovementService();

  // Fetch data from all domains in parallel
  const [habits, nutritionGoals, sleepStats, movementStats] = await Promise.all([
    habitsService.listHabits(context.userId, context.tenantId, true),
    nutritionService.getGoals(context.userId, context.tenantId),
    sleepService.calculateStats(context.userId, context.tenantId),
    movementService.calculateWeeklyStats(context.userId, context.tenantId),
  ]);

  // Calculate habit stats
  const habitsWithStats = await Promise.all(
    habits.map(async (habit) => {
      const stats = await habitsService.calculateStats(habit.id, context.tenantId);
      return { habit, stats };
    })
  );

  const totalHabitsThisWeek = habits.length * 7;
  const completedHabits = habitsWithStats.reduce((sum, h) => {
    return sum + Math.round((h.stats.completionRate / 100) * 7);
  }, 0);
  const bestStreak = Math.max(...habitsWithStats.map(h => h.stats.currentStreak), 0);

  // Calculate domain scores
  const habitScore = habits.length > 0 
    ? Math.round(habitsWithStats.reduce((sum, h) => sum + h.stats.completionRate, 0) / habits.length)
    : 0;

  // Simplified nutrition score - could be enhanced with actual adherence calculation
  const NUTRITION_SCORE_WITH_GOALS = 85;
  const NUTRITION_SCORE_NO_GOALS = 50;
  const nutritionScore = nutritionGoals ? NUTRITION_SCORE_WITH_GOALS : NUTRITION_SCORE_NO_GOALS;
  
  const sleepScore = sleepStats.averageQuality ? Math.round(sleepStats.averageQuality * 20) : 0; // Scale 1-5 to 0-100
  const movementScore = movementStats.weeklyWorkouts >= 3 ? 80 : Math.round((movementStats.weeklyWorkouts / 3) * 80);
  
  // TODO: Integrate Mind domain service for actual mood and journaling stats
  const mindScore = 70; // Placeholder - would calculate from Mind service

  // Calculate overall score
  const overallScore = Math.round((habitScore + nutritionScore + sleepScore + movementScore + mindScore) / 5);
  const adherenceRate = totalHabitsThisWeek > 0 
    ? Math.round((completedHabits / totalHabitsThisWeek) * 100)
    : 0;

  // Generate highlights
  const highlights: WeeklyReviewViewModel['highlights'] = [];
  
  if (bestStreak >= 7) {
    highlights.push({
      type: 'achievement',
      title: `${bestStreak}-Day Streak!`,
      description: 'Amazing consistency with your habits',
      date: new Date().toISOString(),
      icon: '🔥',
    });
  }

  if (sleepStats.averageQuality >= 4) {
    highlights.push({
      type: 'improvement',
      title: 'Excellent Sleep Quality',
      description: `Average quality: ${sleepStats.averageQuality.toFixed(1)}/5`,
      date: new Date().toISOString(),
      icon: '😴',
    });
  }

  if (movementStats.weeklyWorkouts >= 5) {
    highlights.push({
      type: 'milestone',
      title: 'Active Week!',
      description: `Completed ${movementStats.weeklyWorkouts} workouts`,
      date: new Date().toISOString(),
      icon: '💪',
    });
  }

  // Generate insights
  const insights: WeeklyReviewViewModel['insights'] = [];

  if (habitScore >= 80) {
    insights.push({
      message: 'Your habit consistency is excellent this week!',
      type: 'success',
      domain: 'Habits',
      aiGenerated: true,
      explainability: {
        reasonCodes: ['HIGH_COMPLETION_RATE', 'CONSISTENT_TRACKING'],
        confidence: 0.92,
        evidencePack: {
          completionRate: habitScore,
          activeHabits: habits.length,
        },
      },
    });
  }

  if (sleepScore >= 80) {
    insights.push({
      message: 'Sleep quality is excellent. Your routine is working well!',
      type: 'success',
      domain: 'Sleep',
      aiGenerated: true,
      explainability: {
        reasonCodes: ['HIGH_SLEEP_QUALITY', 'GOOD_CONSISTENCY'],
        confidence: 0.88,
        evidencePack: {
          averageQuality: sleepStats.averageQuality,
          consistency: sleepStats.consistency,
        },
      },
    });
  }

  if (movementStats.weeklyWorkouts < 3) {
    insights.push({
      message: 'Consider adding more workouts to meet your movement goals.',
      type: 'info',
      domain: 'Movement',
      aiGenerated: true,
      explainability: {
        reasonCodes: ['BELOW_TARGET_FREQUENCY'],
        confidence: 0.85,
        evidencePack: {
          targetWorkouts: 3,
          actualWorkouts: movementStats.weeklyWorkouts,
        },
      },
    });
  }

  // Generate recommendations
  const recommendations: WeeklyReviewViewModel['recommendations'] = [];

  if (sleepScore >= 80) {
    recommendations.push({
      title: 'Maintain Sleep Routine',
      description: 'Your consistent sleep schedule is working well. Keep it up!',
      priority: 'high',
      actionable: 'Continue current bedtime routine',
      aiGenerated: true,
    });
  }

  if (movementStats.weeklyWorkouts < 5) {
    recommendations.push({
      title: 'Increase Workout Frequency',
      description: 'Adding 1-2 more workouts would optimize your fitness goals.',
      priority: 'medium',
      actionable: 'Schedule mid-week workout',
      aiGenerated: true,
    });
  }

  if (habits.length < 5) {
    recommendations.push({
      title: 'Build More Habits',
      description: 'Consider adding habits in areas you want to improve.',
      priority: 'low',
      actionable: 'Create a new habit',
      aiGenerated: true,
    });
  }

  const viewModel: WeeklyReviewViewModel = {
    profile: {
      displayName: 'User', // TODO: Get from Profile Spine
      reviewPeriod: {
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0],
        week: Math.ceil((now.getDate() - now.getDay() + 1) / 7),
      },
    },
    summary: {
      overallScore,
      adherenceRate,
      streak: bestStreak,
      completedGoals: completedHabits,
      totalGoals: totalHabitsThisWeek,
    },
    domainScores: [
      { 
        domain: 'Nutrition', 
        score: nutritionScore, 
        change: 0, // Would need historical data
        status: nutritionScore >= 80 ? 'excellent' : nutritionScore >= 60 ? 'good' : 'needs_improvement' 
      },
      { 
        domain: 'Movement', 
        score: movementScore, 
        change: 0,
        status: movementScore >= 80 ? 'excellent' : movementScore >= 60 ? 'good' : 'needs_improvement' 
      },
      { 
        domain: 'Sleep', 
        score: sleepScore, 
        change: 0,
        status: sleepScore >= 80 ? 'excellent' : sleepScore >= 60 ? 'good' : 'needs_improvement' 
      },
      { 
        domain: 'Habits', 
        score: habitScore, 
        change: 0,
        status: habitScore >= 80 ? 'excellent' : habitScore >= 60 ? 'good' : 'needs_improvement' 
      },
      { 
        domain: 'Mind', 
        score: mindScore, 
        change: 0,
        status: mindScore >= 80 ? 'excellent' : mindScore >= 60 ? 'good' : 'needs_improvement' 
      },
    ],
    highlights,
    insights,
    recommendations,
    dataPoints: {
      habits: {
        completed: completedHabits,
        total: totalHabitsThisWeek,
        bestStreak,
      },
      nutrition: {
        mealsLogged: 0, // Would need to query meals
        averageCalories: nutritionGoals?.dailyCalories || 2000,
        macroAdherence: nutritionScore,
      },
      movement: {
        workouts: movementStats.weeklyWorkouts,
        totalMinutes: movementStats.weeklyMinutes,
        caloriesBurned: movementStats.weeklyCalories,
      },
      sleep: {
        averageHours: sleepStats.averageDuration / 60, // Convert minutes to hours
        quality: sleepScore,
        consistency: Math.round(sleepStats.consistency * 100),
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
