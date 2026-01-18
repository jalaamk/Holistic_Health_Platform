import { NextRequest } from "next/server";
import { createApiHandler } from "@/utils/api-handler";
import { TodayViewModel, TodayViewModelSchema } from "@/types/view-models";
import { RequestContext } from "@/types/context";
import { entitlementsService } from "@/services/entitlements.service";
import { Logger } from "@/utils/logger";

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

/**
 * GET /api/bff/today
 * Returns the TodayViewModel with current stats and quota information
 */
export const GET = createApiHandler<void, TodayViewModel>(
  async (request: NextRequest, context: RequestContext) => {
    Logger.info(context, "Fetching today data");

    // Check and consume quota for this API call
    await entitlementsService.consumeQuota(context, "api_calls", 1);

    // Get quota status
    const quotaStatus = await entitlementsService.getQuotaStatus(
      context,
      "api_calls"
    );

    // Get current time and greeting
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Good morning";
    if (hour >= 12 && hour < 18) {
      greeting = "Good afternoon";
    } else if (hour >= 18) {
      greeting = "Good evening";
    }

    // Build the view model
    const viewModel: TodayViewModel = {
      date: now.toISOString(),
      greeting,
      tenantId: context.tenantId,
      userId: context.userId,
      quotaStatus: {
        resourceType: "api_calls",
        used: quotaStatus.used + 1, // Include current call
        limit: quotaStatus.limit,
        remaining: quotaStatus.remaining - 1,
      },
      stats: {
        totalRequests: quotaStatus.used + 1,
        activeUsers: 1, // Simplified for demo
      },
    };

    Logger.info(context, "Today data fetched successfully", { viewModel });

    return viewModel;
  },
  {
    responseSchema: TodayViewModelSchema,
    requireAuth: false, // Set to true in production
  }
);
