/**
 * Firebase Identity Provider Adapter
 * Implements IdentityProvider interface using Firebase Auth
 * Phase 0: Fast shipping with Firebase, but behind abstraction
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { 
  getAuth,
  type Auth 
} from 'firebase/auth';
import * as admin from 'firebase-admin';
import type { 
  IdentityProvider, 
  AuthTokenClaims, 
  CreateUserData 
} from './interfaces';
import type { User } from '@/packages/types';
import { getEnv } from '@/packages/config/env';

export class FirebaseIdentityProvider implements IdentityProvider {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private adminAuth: admin.auth.Auth;

  constructor() {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      const env = getEnv();
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    this.adminAuth = admin.auth();
  }

  /**
   * Initialize client-side Firebase (for browser contexts)
   */
  private initClient() {
    if (typeof window === 'undefined') return;
    
    if (!this.app && !getApps().length) {
      const env = getEnv();
      this.app = initializeApp({
        apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });
      this.auth = getAuth(this.app);
    }
  }

  async verifyToken(token: string): Promise<AuthTokenClaims> {
    try {
      const decodedToken = await this.adminAuth.verifyIdToken(token);
      
      return {
        userId: decodedToken.uid,
        email: decodedToken.email || '',
        tenantId: decodedToken.tenantId as string | undefined,
        roles: (decodedToken.roles as string[]) || [],
        expiresAt: decodedToken.exp,
      };
    } catch (error) {
      throw new Error(`Token verification failed: ${error}`);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      const userRecord = await this.adminAuth.getUser(userId);
      
      return {
        id: userRecord.uid,
        tenantId: (userRecord.customClaims?.tenantId as string) || '',
        email: userRecord.email || '',
        displayName: userRecord.displayName,
        roles: (userRecord.customClaims?.roles as string[]) || [],
        externalOrgId: userRecord.customClaims?.externalOrgId as string | undefined,
        externalUserId: userRecord.customClaims?.externalUserId as string | undefined,
        idpProvider: userRecord.customClaims?.idpProvider as string | undefined,
        scimProvisioned: userRecord.customClaims?.scimProvisioned as boolean | undefined,
        createdAt: new Date(userRecord.metadata.creationTime),
        updatedAt: new Date(userRecord.metadata.lastSignInTime || userRecord.metadata.creationTime),
      };
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') {
        return null;
      }
      throw error;
    }
  }

  async createUser(data: CreateUserData): Promise<User> {
    try {
      const userRecord = await this.adminAuth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
      });

      // Set custom claims
      await this.adminAuth.setCustomUserClaims(userRecord.uid, {
        tenantId: data.tenantId,
        roles: data.roles || [],
      });

      return {
        id: userRecord.uid,
        tenantId: data.tenantId,
        email: userRecord.email || '',
        displayName: userRecord.displayName,
        roles: data.roles || [],
        createdAt: new Date(userRecord.metadata.creationTime),
        updatedAt: new Date(userRecord.metadata.creationTime),
      };
    } catch (error) {
      throw new Error(`Failed to create user: ${error}`);
    }
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    try {
      const updates: admin.auth.UpdateRequest = {};
      
      if (data.email) updates.email = data.email;
      if (data.displayName) updates.displayName = data.displayName;
      
      await this.adminAuth.updateUser(userId, updates);

      // Update custom claims if needed
      if (data.roles || data.tenantId) {
        const currentUser = await this.getUser(userId);
        await this.adminAuth.setCustomUserClaims(userId, {
          tenantId: data.tenantId || currentUser?.tenantId,
          roles: data.roles || currentUser?.roles,
        });
      }

      const updatedUser = await this.getUser(userId);
      if (!updatedUser) {
        throw new Error('User not found after update');
      }
      
      return updatedUser;
    } catch (error) {
      throw new Error(`Failed to update user: ${error}`);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await this.adminAuth.deleteUser(userId);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error}`);
    }
  }

  async createCustomToken(userId: string, claims?: Record<string, unknown>): Promise<string> {
    try {
      return await this.adminAuth.createCustomToken(userId, claims);
    } catch (error) {
      throw new Error(`Failed to create custom token: ${error}`);
    }
  }
}

// Singleton instance
let identityProvider: FirebaseIdentityProvider | null = null;

export function getIdentityProvider(): IdentityProvider {
  if (!identityProvider) {
    identityProvider = new FirebaseIdentityProvider();
  }
  return identityProvider;
}
