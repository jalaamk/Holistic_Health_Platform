import { IDatabase } from "@/interfaces/database.interface";
import { database } from "@/lib/firestore-database.service";

export interface Quota {
  id: string;
  tenantId: string;
  resourceType: string;
  limit: number;
  used: number;
  resetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class QuotaRepository {
  constructor(private db: IDatabase = database) {}

  async findByTenantAndResource(
    tenantId: string,
    resourceType: string
  ): Promise<Quota | null> {
    const quotas = await this.db
      .collection<Quota>("quotas")
      .query()
      .where("tenantId", "==", tenantId)
      .where("resourceType", "==", resourceType)
      .limit(1)
      .get();
    
    return quotas[0] || null;
  }

  async create(quotaData: Omit<Quota, "id">): Promise<string> {
    return await this.db.collection<Quota>("quotas").add(quotaData);
  }

  async update(quotaId: string, data: Partial<Quota>): Promise<void> {
    await this.db
      .collection<Quota>("quotas")
      .doc(quotaId)
      .update({ ...data, updatedAt: new Date() });
  }

  async incrementUsage(quotaId: string, amount: number = 1): Promise<void> {
    const quota = await this.db.collection<Quota>("quotas").doc(quotaId).get();
    if (!quota) {
      throw new Error("Quota not found");
    }
    
    await this.update(quotaId, {
      used: quota.used + amount,
    });
  }

  async resetUsage(quotaId: string): Promise<void> {
    await this.update(quotaId, {
      used: 0,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  }
}

export const quotaRepository = new QuotaRepository();
