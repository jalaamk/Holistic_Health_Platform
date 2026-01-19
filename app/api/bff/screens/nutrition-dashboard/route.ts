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

  // TODO: Fetch real data from Nutrition domain
  const viewModel: NutritionDashboardViewModel = {
    profile: {
      displayName: 'User',
      dailyGoals: {
        calories: 2000,
        protein: 150,
        carbs: 225,
        fat: 67,
      },
    },
    todaysSummary: {
      date: new Date().toISOString().split('T')[0],
      calories: {
        consumed: 1450,
        goal: 2000,
        remaining: 550,
      },
      macros: {
        protein: { grams: 98, percentage: 27 },
        carbs: { grams: 165, percentage: 45 },
        fat: { grams: 45, percentage: 28 },
      },
      water: {
        glasses: 6,
        goal: 8,
      },
    },
    recentMeals: [
      {
        id: '1',
        name: 'Greek Yogurt with Berries',
        type: 'breakfast',
        time: new Date(Date.now() - 21600000).toISOString(),
        calories: 320,
        macros: { protein: 25, carbs: 42, fat: 8 },
      },
      {
        id: '2',
        name: 'Chicken Salad',
        type: 'lunch',
        time: new Date(Date.now() - 10800000).toISOString(),
        calories: 480,
        macros: { protein: 45, carbs: 35, fat: 18 },
      },
      {
        id: '3',
        name: 'Apple with Almond Butter',
        type: 'snack',
        time: new Date(Date.now() - 5400000).toISOString(),
        calories: 220,
        macros: { protein: 8, carbs: 28, fat: 12 },
      },
      {
        id: '4',
        name: 'Grilled Salmon with Vegetables',
        type: 'dinner',
        time: new Date(Date.now() - 1800000).toISOString(),
        calories: 430,
        macros: { protein: 42, carbs: 25, fat: 20 },
      },
    ],
    weeklyTrends: {
      averageCalories: 1850,
      adherenceRate: 85,
      trend: 'improving',
    },
    insights: [
      {
        message: 'Great protein intake today! You\'re 65% towards your goal.',
        type: 'success',
        aiGenerated: false,
      },
      {
        message: 'You have 550 calories remaining. Consider a light dinner.',
        type: 'info',
        aiGenerated: false,
      },
      {
        message: 'Your macro balance is optimal for your goals.',
        type: 'success',
        aiGenerated: true,
        confidenceScore: 0.89,
      },
      {
        message: 'Don\'t forget to drink 2 more glasses of water before bed.',
        type: 'info',
        aiGenerated: false,
      },
    ],
  };

  return viewModel;
}

// Export route handler
export const GET = createApiHandler({
  auth: true,
  handler,
});
