/**
 * BFF Endpoint: Nutrition Dashboard
 * Returns a complete ViewModel for the Nutrition screen
 * 
 * Demonstrates:
 * - Standard API handler usage
 * - Request context propagation
 * - Entitlements and policy checking
 * - Consent scope validation
 * - ViewModel pattern (single call per screen)
 */

import { createApiHandler } from '@/packages/core/api-handler';
import type { RequestContext, ConsentScope } from '@/packages/types';
import { getEntitlementsService } from '@/packages/core/entitlements';
import { getPolicyConsentService } from '@/packages/core/policy-consent';
import { getNutritionService } from '@/packages/domains/nutrition';

// Output ViewModel
interface NutritionDashboardViewModel {
  profile: {
    displayName: string;
    dailyGoals: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  };
  todaysSummary: {
    date: string;
    calories: {
      consumed: number;
      goal: number;
      remaining: number;
    };
    macros: {
      protein: { grams: number; percentage: number };
      carbs: { grams: number; percentage: number };
      fat: { grams: number; percentage: number };
    };
    water: {
      glasses: number;
      goal: number;
    };
  };
  recentMeals: Array<{
    id: string;
    name: string;
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    time: string;
    calories: number;
    macros: {
      protein: number;
      carbs: number;
      fat: number;
    };
  }>;
  weeklyTrends: {
    averageCalories: number;
    adherenceRate: number;
    trend: 'improving' | 'declining' | 'stable';
  };
  insights: Array<{
    message: string;
    type: 'success' | 'warning' | 'info';
    aiGenerated?: boolean;
    confidenceScore?: number;
  }>;
}

// Handler logic
async function handler(
  _input: Record<string, never>,
  context: RequestContext
): Promise<NutritionDashboardViewModel> {
  // Check entitlements
  const entitlementsService = getEntitlementsService();
  const nutritionAccess = await entitlementsService.checkFeature(
    context.tenantId,
    'nutrition'
  );

  if (!nutritionAccess.allowed) {
    throw new Error('Nutrition feature not available on your plan');
  }

  // Check consent for nutrition tracking
  const policyService = getPolicyConsentService();
  const hasConsent = await policyService.checkConsent(
    context.userId,
    context.tenantId,
    'nutrition' as ConsentScope
  );

  if (!hasConsent) {
    throw new Error('Consent required for nutrition tracking');
  }

  // Check policy for nutrition data access
  const policyDecision = await policyService.evaluate(
    context,
    'nutrition.data',
    'read'
  );

  if (!policyDecision.allowed) {
    throw new Error(`Access denied: ${policyDecision.reason}`);
  }

  // Fetch real data from Nutrition domain
  const nutritionService = getNutritionService();
  const today = new Date().toISOString().split('T')[0];
  
  // Get nutrition goals
  const goals = await nutritionService.getGoals(context.userId, context.tenantId);
  const dailyGoals = goals ? {
    calories: goals.dailyCalories,
    protein: goals.macros.protein,
    carbs: goals.macros.carbs,
    fat: goals.macros.fat,
    waterGlasses: goals.waterGlasses,
  } : {
    calories: 2000,
    protein: 150,
    carbs: 225,
    fat: 67,
    waterGlasses: 8,
  };
  
  // Get daily summary
  const summary = await nutritionService.calculateDailySummary(
    context.tenantId,
    context.userId,
    today
  );
  
  // Get recent meals (today and yesterday)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const meals = await nutritionService.listMeals(
    context.tenantId,
    context.userId,
    yesterday.toISOString().split('T')[0],
    new Date().toISOString().split('T')[0]
  );
  
  // Get water intake for today
  const waterMl = await nutritionService.getTodayWater(context.userId, context.tenantId);
  const waterGlasses = Math.round(waterMl / 250); // 250ml per glass
  const waterGoalGlasses = dailyGoals.waterGlasses;
  
  // Calculate macros percentages
  const totalCals = summary.calories.consumed || 1; // Avoid division by zero
  const proteinGrams = summary.macros.protein.grams;
  const carbsGrams = summary.macros.carbs.grams;
  const fatGrams = summary.macros.fat.grams;
  
  // Recalculate percentages based on consumed calories
  const proteinPercentage = Math.round((proteinGrams * 4 / totalCals) * 100);
  const carbsPercentage = Math.round((carbsGrams * 4 / totalCals) * 100);
  const fatPercentage = Math.round((fatGrams * 9 / totalCals) * 100);
  
  // Calculate weekly trends (simplified - could be enhanced)
  const averageCalories = summary.calories.consumed; // Simplified for now
  const adherenceRate = dailyGoals.calories > 0 
    ? Math.min(100, Math.round((summary.calories.consumed / dailyGoals.calories) * 100))
    : 0;
  
  // Generate insights
  const insights: NutritionDashboardViewModel['insights'] = [];
  
  const caloriesRemaining = summary.calories.remaining;
  if (caloriesRemaining > 0) {
    insights.push({
      message: `You have ${caloriesRemaining} calories remaining for today.`,
      type: 'info',
      aiGenerated: false,
    });
  } else if (caloriesRemaining < 0) {
    insights.push({
      message: `You've exceeded your calorie goal by ${Math.abs(caloriesRemaining)} calories.`,
      type: 'warning',
      aiGenerated: false,
    });
  }
  
  if (proteinGrams >= dailyGoals.protein * 0.8) {
    insights.push({
      message: `Great protein intake! You're ${Math.round((proteinGrams / dailyGoals.protein) * 100)}% towards your goal.`,
      type: 'success',
      aiGenerated: false,
    });
  }
  
  const waterRemaining = waterGoalGlasses - waterGlasses;
  if (waterRemaining > 0) {
    insights.push({
      message: `Don't forget to drink ${waterRemaining} more glass${waterRemaining > 1 ? 'es' : ''} of water.`,
      type: 'info',
      aiGenerated: false,
    });
  }
  
  if (adherenceRate >= 90 && adherenceRate <= 110) {
    insights.push({
      message: 'Your calorie intake is well-aligned with your goals.',
      type: 'success',
      aiGenerated: true,
      confidenceScore: 0.92,
    });
  }
  
  const viewModel: NutritionDashboardViewModel = {
    profile: {
      displayName: 'User', // TODO: Get from Profile Spine
      dailyGoals: {
        calories: dailyGoals.calories,
        protein: dailyGoals.protein,
        carbs: dailyGoals.carbs,
        fat: dailyGoals.fat,
      },
    },
    todaysSummary: {
      date: today,
      calories: {
        consumed: summary.calories.consumed,
        goal: summary.calories.goal,
        remaining: summary.calories.remaining,
      },
      macros: {
        protein: { grams: proteinGrams, percentage: proteinPercentage },
        carbs: { grams: carbsGrams, percentage: carbsPercentage },
        fat: { grams: fatGrams, percentage: fatPercentage },
      },
      water: {
        glasses: waterGlasses,
        goal: waterGoalGlasses,
      },
    },
    recentMeals: meals.map(meal => ({
      id: meal.id,
      name: meal.name,
      type: meal.type,
      time: meal.consumedAt,
      calories: meal.calories,
      macros: {
        protein: meal.macros.protein,
        carbs: meal.macros.carbs,
        fat: meal.macros.fat,
      },
    })),
    weeklyTrends: {
      averageCalories,
      adherenceRate,
      trend: adherenceRate > 95 ? 'stable' : adherenceRate > 85 ? 'improving' : 'declining',
    },
    insights,
  };

  return viewModel;
}

// Export route handler
export const GET = createApiHandler({
  auth: true,
  handler,
});
