import { z } from "zod";

/**
 * TodayViewModel - Typed view model for the Today page
 */
export const TodayViewModelSchema = z.object({
  date: z.string(),
  greeting: z.string(),
  tenantId: z.string(),
  userId: z.string().optional(),
  quotaStatus: z.object({
    resourceType: z.string(),
    used: z.number(),
    limit: z.number(),
    remaining: z.number(),
  }),
  stats: z.object({
    totalRequests: z.number(),
    activeUsers: z.number(),
  }),
});

export type TodayViewModel = z.infer<typeof TodayViewModelSchema>;
