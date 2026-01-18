/**
 * Authentication interface - abstracts auth provider
 */
export interface IAuthService {
  verifyToken(token: string): Promise<AuthUser>;
  getCurrentUser(): Promise<AuthUser | null>;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  tenantId: string;
}
