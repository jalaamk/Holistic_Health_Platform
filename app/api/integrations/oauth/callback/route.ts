/**
 * OAuth Callback Handler for Integrations
 * 
 * Handles OAuth redirects from integration providers (Fitbit, Google Fit, etc.)
 * Exchanges authorization code for tokens and creates connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationRegistry } from '@/packages/integrations/integration-registry';
import { createFitbitAdapter } from '@/packages/integrations/adapters/fitbit';
import type { IntegrationProvider } from '@/packages/integrations/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      return NextResponse.json(
        {
          error: 'oauth_error',
          message: `Integration authorization failed: ${error}`,
        },
        { status: 400 }
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.json(
        {
          error: 'missing_parameters',
          message: 'Missing required OAuth parameters',
        },
        { status: 400 }
      );
    }

    // Decode state (format: provider:tenantId:userId:redirectUrl)
    const [provider, tenantId, userId, redirectUrl] = state.split(':');

    if (!provider || !tenantId || !userId) {
      return NextResponse.json(
        {
          error: 'invalid_state',
          message: 'Invalid OAuth state parameter',
        },
        { status: 400 }
      );
    }

    // Get appropriate adapter based on provider
    let adapter;
    let category: 'wearable' | 'ehr' | 'calendar';

    switch (provider as IntegrationProvider) {
      case 'fitbit':
        adapter = createFitbitAdapter();
        category = 'wearable';
        break;
      // Add more adapters as implemented
      default:
        return NextResponse.json(
          {
            error: 'unsupported_provider',
            message: `Provider ${provider} is not supported`,
          },
          { status: 400 }
        );
    }

    // Exchange code for tokens
    const callbackUrl = `${request.nextUrl.origin}/api/integrations/oauth/callback`;
    const tokens = await adapter.exchangeCodeForTokens(code, callbackUrl);

    // Create integration connection
    const registry = getIntegrationRegistry();
    const connection = await registry.createConnection(
      tenantId,
      userId,
      provider as IntegrationProvider,
      category,
      tokens,
      {
        connectedAt: new Date().toISOString(),
        source: 'oauth_flow',
      }
    );

    console.log(
      `[OAuth] Connection created: ${connection.id} for user ${userId}`
    );

    // Redirect to success page or app
    const successUrl = redirectUrl
      ? decodeURIComponent(redirectUrl)
      : `/integrations?connected=${provider}`;

    return NextResponse.redirect(new URL(successUrl, request.url));
  } catch (error) {
    console.error('[OAuth] Callback error:', error);

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Failed to complete OAuth flow',
      },
      { status: 500 }
    );
  }
}
