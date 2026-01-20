/**
 * Integrations Management API
 * 
 * Endpoints for managing user integrations:
 * - GET: List user's connected integrations
 * - POST: Initiate OAuth flow for new integration
 * - DELETE: Revoke an integration connection
 */

import { z } from 'zod';
import { createApiHandler } from '@/packages/core/api-handler';
import { getIntegrationRegistry } from '@/packages/integrations/integration-registry';
import { createFitbitAdapter } from '@/packages/integrations/adapters/fitbit';
import type { IntegrationProvider } from '@/packages/integrations/types';

// List user's integrations
export const GET = createApiHandler({
  auth: true,
  handler: async (_, context) => {
    const { userId, tenantId } = context;

    const registry = getIntegrationRegistry();
    const connections = await registry.listConnections(tenantId, userId);

    // Don't expose sensitive token data
    const safeConnections = connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      category: conn.category,
      status: conn.status,
      lastSyncAt: conn.lastSyncAt,
      createdAt: conn.createdAt,
      scopes: conn.tokens.scope,
    }));

    return {
      connections: safeConnections,
      count: safeConnections.length,
    };
  },
});

// Initiate OAuth flow
const InitiateOAuthSchema = z.object({
  provider: z.enum([
    'fitbit',
    'apple_health',
    'google_fit',
    'garmin',
    'whoop',
    'oura',
  ]),
  redirectUrl: z.string().url().optional(),
});

export const POST = createApiHandler({
  auth: true,
  validation: InitiateOAuthSchema,
  handler: async (input, context) => {
    const { provider, redirectUrl } = input;
    const { userId, tenantId, requestId } = context;

    // Get appropriate adapter
    let adapter;

    switch (provider as IntegrationProvider) {
      case 'fitbit':
        adapter = createFitbitAdapter();
        break;
      // Add more adapters as implemented
      default:
        throw new Error(`Provider ${provider} is not yet supported`);
    }

    // Build state parameter with encoded redirect URL
    const state = [
      provider,
      tenantId,
      userId,
      redirectUrl ? encodeURIComponent(redirectUrl) : '',
    ].join(':');

    // Get authorization URL
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback`;
    const authUrl = adapter.getAuthorizationUrl(callbackUrl, state);

    return {
      provider,
      authorizationUrl: authUrl,
      requestId,
    };
  },
});

// Revoke integration
const RevokeSchema = z.object({
  connectionId: z.string().uuid(),
});

export const DELETE = createApiHandler({
  auth: true,
  validation: RevokeSchema,
  handler: async (input, context) => {
    const { connectionId } = input;
    const { userId, tenantId } = context;

    const registry = getIntegrationRegistry();
    const connection = await registry.getConnection(
      connectionId,
      tenantId,
      userId
    );

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Get adapter to revoke OAuth access
    let adapter;

    switch (connection.provider) {
      case 'fitbit':
        adapter = createFitbitAdapter();
        break;
      default:
        throw new Error(`Provider ${connection.provider} is not supported`);
    }

    // Revoke OAuth tokens with provider
    try {
      await adapter.revokeAccess(connection.tokens.accessToken);
    } catch (error) {
      console.error(
        `[Integrations] Failed to revoke OAuth token for ${connection.provider}:`,
        error
      );
      // Continue with local revocation even if provider revocation fails
    }

    // Mark connection as revoked
    await registry.revokeConnection(connectionId, tenantId, userId);

    return {
      success: true,
      connectionId,
      provider: connection.provider,
    };
  },
});
