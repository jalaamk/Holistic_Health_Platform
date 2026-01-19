/**
 * Fitbit Integration Adapter
 * 
 * Implementation of IntegrationProviderAdapter for Fitbit API.
 * Handles OAuth flow, data syncing, and webhook validation.
 */

import crypto from 'crypto';
import type {
  IntegrationProviderAdapter,
  IntegrationConnection,
  OAuthTokens,
  WearableActivityData,
  WearableSleepData,
} from '../types';

// Fitbit API configuration
const FITBIT_OAUTH_BASE = 'https://www.fitbit.com/oauth2';
const FITBIT_API_BASE = 'https://api.fitbit.com';

interface FitbitConfig {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}

export class FitbitAdapter implements IntegrationProviderAdapter {
  provider = 'fitbit' as const;
  category = 'wearable' as const;
  
  private config: FitbitConfig;

  constructor(config: FitbitConfig) {
    this.config = config;
  }

  // OAuth Flow

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: [
        'activity',
        'heartrate',
        'sleep',
        'nutrition',
        'weight',
        'profile',
      ].join(' '),
      state,
    });

    return `${FITBIT_OAUTH_BASE}/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokens> {
    const response = await fetch(`${FITBIT_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${this.config.clientId}:${this.config.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Fitbit OAuth failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000
      ).toISOString(),
      scope: data.scope.split(' '),
      tokenType: data.token_type,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(`${FITBIT_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${this.config.clientId}:${this.config.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Fitbit token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000
      ).toISOString(),
      scope: data.scope.split(' '),
      tokenType: data.token_type,
    };
  }

  async revokeAccess(accessToken: string): Promise<void> {
    const response = await fetch(`${FITBIT_OAUTH_BASE}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${this.config.clientId}:${this.config.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        token: accessToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Fitbit revoke failed: ${response.statusText}`);
    }
  }

  // Data Syncing

  async syncActivities(
    connection: IntegrationConnection,
    since?: Date
  ): Promise<WearableActivityData[]> {
    // Use current date if no since parameter
    const date = since || new Date();
    const dateStr = date.toISOString().split('T')[0];

    const response = await fetch(
      `${FITBIT_API_BASE}/1/user/-/activities/date/${dateStr}.json`,
      {
        headers: {
          Authorization: `Bearer ${connection.tokens.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fitbit activities fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Fitbit data to our format
    const activities: WearableActivityData[] = [];

    if (data.activities) {
      for (const activity of data.activities) {
        activities.push({
          provider: 'fitbit',
          externalId: activity.logId.toString(),
          userId: connection.userId,
          timestamp: activity.startTime,
          activityType: activity.activityName,
          duration: activity.duration / 60000, // Convert ms to minutes
          distance: activity.distance ? activity.distance * 1000 : undefined, // km to meters
          calories: activity.calories,
          heartRate: activity.averageHeartRate
            ? {
                average: activity.averageHeartRate,
                min: 0, // Fitbit doesn't provide this in basic response
                max: 0,
              }
            : undefined,
          metadata: {
            steps: activity.steps,
            level: activity.activityLevel,
          },
        });
      }
    }

    return activities;
  }

  async syncSleep(
    connection: IntegrationConnection,
    since?: Date
  ): Promise<WearableSleepData[]> {
    const date = since || new Date();
    const dateStr = date.toISOString().split('T')[0];

    const response = await fetch(
      `${FITBIT_API_BASE}/1.2/user/-/sleep/date/${dateStr}.json`,
      {
        headers: {
          Authorization: `Bearer ${connection.tokens.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Fitbit sleep fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    const sleepData: WearableSleepData[] = [];

    if (data.sleep) {
      for (const sleep of data.sleep) {
        let stages;
        if (sleep.levels?.summary) {
          const summary = sleep.levels.summary;
          stages = {
            deep: summary.deep?.minutes || 0,
            light: summary.light?.minutes || 0,
            rem: summary.rem?.minutes || 0,
            awake: summary.wake?.minutes || 0,
          };
        }

        sleepData.push({
          provider: 'fitbit',
          externalId: sleep.logId.toString(),
          userId: connection.userId,
          startTime: sleep.startTime,
          endTime: sleep.endTime,
          duration: sleep.duration / 60000, // ms to minutes
          quality: sleep.efficiency, // 0-100
          stages,
          metadata: {
            type: sleep.type, // 'stages' or 'classic'
            minutesAsleep: sleep.minutesAsleep,
            minutesAwake: sleep.minutesAwake,
          },
        });
      }
    }

    return sleepData;
  }

  // Webhook Validation

  validateWebhook(payload: unknown, signature: string): boolean {
    const payloadStr = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payloadStr)
      .digest('base64');

    return signature === expectedSignature;
  }
}

// Factory function for creating Fitbit adapter
export function createFitbitAdapter(): FitbitAdapter {
  const config: FitbitConfig = {
    clientId: process.env.FITBIT_CLIENT_ID || '',
    clientSecret: process.env.FITBIT_CLIENT_SECRET || '',
    webhookSecret: process.env.FITBIT_WEBHOOK_SECRET || '',
  };

  if (!config.clientId || !config.clientSecret) {
    console.warn('[FitbitAdapter] Missing configuration - integration will not work');
  }

  return new FitbitAdapter(config);
}
