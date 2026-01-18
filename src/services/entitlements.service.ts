import { QuotaRepository, quotaRepository } from "@/repositories/quota.repository";
import { QuotaExceededError } from "@/types/errors";
import { RequestContext } from "@/types/context";

export interface EntitlementCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
}

export class EntitlementsService {
  constructor(private quotaRepo: QuotaRepository = quotaRepository) {}

  async checkQuota(
    context: RequestContext,
    resourceType: string
  ): Promise<EntitlementCheck> {
    let quota = await this.quotaRepo.findByTenantAndResource(
      context.tenantId,
      resourceType
    );

    // Initialize quota if it doesn't exist (default 1000 for demo)
    if (!quota) {
      await this.quotaRepo.create({
        tenantId: context.tenantId,
        resourceType,
        limit: 1000,
        used: 0,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      quota = await this.quotaRepo.findByTenantAndResource(
        context.tenantId,
        resourceType
      );
      
      if (!quota) {
        throw new Error("Failed to create quota");
      }
    }

    // Check if quota needs reset
    if (new Date() > quota.resetAt) {
      await this.quotaRepo.resetUsage(quota.id);
      quota.used = 0;
      quota.resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const remaining = quota.limit - quota.used;
    const allowed = remaining > 0;

    return {
      allowed,
      remaining,
      limit: quota.limit,
      used: quota.used,
    };
  }

  async consumeQuota(
    context: RequestContext,
    resourceType: string,
    amount: number = 1
  ): Promise<void> {
    const check = await this.checkQuota(context, resourceType);

    if (!check.allowed || check.remaining < amount) {
      throw new QuotaExceededError(
        `Quota exceeded for ${resourceType}. Used: ${check.used}/${check.limit}`
      );
    }

    const quota = await this.quotaRepo.findByTenantAndResource(
      context.tenantId,
      resourceType
    );

    if (!quota) {
      throw new Error("Quota not found");
    }

    await this.quotaRepo.incrementUsage(quota.id, amount);
  }

  async getQuotaStatus(
    context: RequestContext,
    resourceType: string
  ): Promise<EntitlementCheck> {
    return await this.checkQuota(context, resourceType);
  }
}

export const entitlementsService = new EntitlementsService();
