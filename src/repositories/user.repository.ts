import { IDatabase } from "@/interfaces/database.interface";
import { database } from "@/lib/firestore-database.service";

export interface User {
  id: string;
  email: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserRepository {
  constructor(private db: IDatabase = database) {}

  async findById(userId: string, tenantId: string): Promise<User | null> {
    const user = await this.db
      .collection<User>("users")
      .doc(userId)
      .get();
    
    if (user && user.tenantId === tenantId) {
      return user;
    }
    return null;
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const users = await this.db
      .collection<User>("users")
      .query()
      .where("email", "==", email)
      .where("tenantId", "==", tenantId)
      .limit(1)
      .get();
    
    return users[0] || null;
  }

  async create(userData: Omit<User, "id">): Promise<string> {
    return await this.db.collection<User>("users").add(userData);
  }

  async update(userId: string, tenantId: string, data: Partial<User>): Promise<void> {
    const user = await this.findById(userId, tenantId);
    if (!user) {
      throw new Error("User not found");
    }
    
    await this.db
      .collection<User>("users")
      .doc(userId)
      .update({ ...data, updatedAt: new Date() });
  }
}

export const userRepository = new UserRepository();
