import { IAuthService, AuthUser } from "@/interfaces/auth.interface";
import { getFirebaseAdmin } from "./firebase-admin";
import { AuthenticationError } from "@/types/errors";

export class FirebaseAuthService implements IAuthService {
  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const { auth } = getFirebaseAdmin();
      const decodedToken = await auth.verifyIdToken(token);
      
      return {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        tenantId: decodedToken.tenant_id || "default",
      };
    } catch {
      throw new AuthenticationError("Invalid authentication token");
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    // This would typically be implemented on the client side
    // For server-side, we rely on verifyToken
    return null;
  }
}

export const authService = new FirebaseAuthService();
