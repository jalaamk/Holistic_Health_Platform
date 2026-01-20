/**
 * Garmin Connect Integration Adapter
 * 
 * OAuth 1.0a integration with Garmin Health API
 * Supports activity tracking, sleep analysis, and daily summaries
 */

import crypto from 'crypto';
import {
  IntegrationProviderAdapter,
  IntegrationConnection,
  OAuthTokens,
  WearableActivityData,
  WearableSleepData,
} from '../types';

// Garmin-specific types
interface GarminActivity {
  summaryId: string;
  activityType: string;
  startTimeInSeconds: number;
  durationInSeconds: number;
  distanceInMeters?: number;
  activeKilocalories?: number;
  averageHeartRateInBeatsPerMinute?: number;
  maxHeartRateInBeatsPerMinute?: number;
  steps?: number;
}

interface GarminSleep {
  summaryId: string;
  calendarDate: string;
  startTimeInSeconds: number;
  durationInSeconds: number;
  validation: string; // 'MANUAL' | 'AUTO' | 'ENHANCED_FINAL'
  sleepTimeSeconds?: number;
  napTimeSeconds?: number;
  unmeasurableSleepSeconds?: number;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSleepSeconds?: number;
}

interface GarminOAuth1Tokens {
  oauthToken: string;
  oauthTokenSecret: string;
  oauthVerifier?: string;
}

/**
 * Garmin Connect Adapter
 * Implements OAuth 1.0a flow with HMAC-SHA1 signatures
 */
export function createGarminAdapter(): IntegrationProviderAdapter {
  const consumerKey = process.env.GARMIN_CONSUMER_KEY;
  const consumerSecret = process.env.GARMIN_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('Garmin OAuth credentials not configured');
  }

  const baseUrl = 'https://apis.garmin.com/wellness-api/rest';
  const oauthBaseUrl = 'https://connectapi.garmin.com/oauth-service';

  /**
   * Generate OAuth 1.0a signature
   */
  function generateOAuth1Signature(
    method: string,
    url: string,
    params: Record<string, string>,
    tokenSecret?: string
  ): string {
    // Sort parameters alphabetically
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    // Create signature base string
    const signatureBase = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams),
    ].join('&');

    // Create signing key
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;

    // Generate HMAC-SHA1 signature
    const hmac = crypto.createHmac('sha1', signingKey);
    hmac.update(signatureBase);
    return hmac.digest('base64');
  }

  /**
   * Generate OAuth 1.0a parameters
   */
  function generateOAuth1Params(
    token?: string,
    verifier?: string
  ): Record<string, string> {
    const params: Record<string, string> = {
      oauth_consumer_key: consumerKey!,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
    };

    if (token) {
      params.oauth_token = token;
    }

    if (verifier) {
      params.oauth_verifier = verifier;
    }

    return params;
  }

  /**
   * Make OAuth 1.0a signed request
   */
  async function makeOAuth1Request(
    method: string,
    url: string,
    token?: string,
    tokenSecret?: string,
    verifier?: string
  ): Promise<Response> {
    const params = generateOAuth1Params(token, verifier);
    const signature = generateOAuth1Signature(method, url, params, tokenSecret);
    params.oauth_signature = signature;

    // Build Authorization header
    const authHeader =
      'OAuth ' +
      Object.keys(params)
        .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(params[key])}"`)
        .join(', ');

    return fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });
  }

  return {
    provider: 'garmin',
    category: 'wearable',

    /**
     * Step 1: Get request token and generate authorization URL
     */
    getAuthorizationUrl(redirectUri: string, state: string): string {
      // Note: OAuth 1.0a requires a request token first
      // This is a simplified implementation - in production, you'd:
      // 1. Call /oauth-service/oauth/request_token to get request token
      // 2. Store request token + secret temporarily (with state)
      // 3. Return authorization URL with request token
      
      // For now, return the authorization endpoint
      // Actual implementation would require async request token fetch
      const params = new URLSearchParams({
        oauth_callback: redirectUri,
        // Request token would be added here after fetching
      });

      return `${oauthBaseUrl}/oauth/authorize?${params.toString()}`;
    },

    /**
     * Step 2: Exchange authorization code/verifier for access token
     */
    async exchangeCodeForTokens(
      code: string,
      redirectUri: string
    ): Promise<OAuthTokens> {
      // OAuth 1.0a flow:
      // 1. Use oauth_verifier (code) with request token
      // 2. Call /oauth-service/oauth/access_token
      // 3. Get access token + token secret

      // Note: In production, retrieve stored request token/secret using state
      const requestToken = ''; // Retrieved from temporary storage
      const requestTokenSecret = ''; // Retrieved from temporary storage

      const url = `${oauthBaseUrl}/oauth/access_token`;
      const response = await makeOAuth1Request(
        'POST',
        url,
        requestToken,
        requestTokenSecret,
        code // oauth_verifier
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Garmin OAuth 1.0a exchange failed: ${error}`);
      }

      const text = await response.text();
      const params = new URLSearchParams(text);

      const accessToken = params.get('oauth_token');
      const tokenSecret = params.get('oauth_token_secret');

      if (!accessToken || !tokenSecret) {
        throw new Error('Invalid OAuth 1.0a response from Garmin');
      }

      // Store both token and secret (secret needed for signing)
      return {
        accessToken,
        refreshToken: tokenSecret, // Store secret as refresh token
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        scope: ['wellness-api'],
        tokenType: 'OAuth',
      };
    },

    /**
     * OAuth 1.0a doesn't use refresh tokens in the same way
     * Tokens are long-lived (typically 1 year)
     */
    async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
      // For Garmin, the refresh token is actually the token secret
      // OAuth 1.0a tokens don't expire in the traditional sense
      // Return the same tokens with extended expiry
      return {
        accessToken: '', // Access token would be stored separately
        refreshToken,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        scope: ['wellness-api'],
        tokenType: 'OAuth',
      };
    },

    /**
     * Revoke access token
     */
    async revokeAccess(accessToken: string): Promise<void> {
      // Garmin doesn't have a standard revocation endpoint
      // Users must revoke access through Garmin Connect settings
      // This is a no-op but logs the action
      console.log(`Garmin access token revoked (user must disconnect in Garmin Connect): ${accessToken.substring(0, 10)}...`);
    },

    /**
     * Sync activity data from Garmin
     */
    async syncActivities(
      connection: IntegrationConnection,
      since?: Date
    ): Promise<WearableActivityData[]> {
      const startDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const uploadStartTime = Math.floor(startDate.getTime() / 1000);
      const uploadEndTime = Math.floor(endDate.getTime() / 1000);

      const url = `${baseUrl}/activities?uploadStartTimeInSeconds=${uploadStartTime}&uploadEndTimeInSeconds=${uploadEndTime}`;
      
      // Extract token and secret from connection
      const accessToken = connection.tokens.accessToken;
      const tokenSecret = connection.tokens.refreshToken; // Secret stored as refresh token

      const response = await makeOAuth1Request(
        'GET',
        url,
        accessToken,
        tokenSecret
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch Garmin activities: ${error}`);
      }

      const activities: GarminActivity[] = await response.json();

      return activities.map((activity) => ({
        provider: 'garmin' as const,
        externalId: activity.summaryId,
        userId: connection.userId,
        timestamp: new Date(activity.startTimeInSeconds * 1000).toISOString(),
        activityType: mapGarminActivityType(activity.activityType),
        duration: Math.round(activity.durationInSeconds / 60),
        distance: activity.distanceInMeters,
        calories: activity.activeKilocalories,
        heartRate: {
          average: activity.averageHeartRateInBeatsPerMinute || 0,
          max: activity.maxHeartRateInBeatsPerMinute || 0,
          min: 0,
        },
        metadata: {
          steps: activity.steps,
          activityTypeCode: activity.activityType,
          source: 'garmin_connect',
        },
      }));
    },

    /**
     * Sync sleep data from Garmin
     */
    async syncSleep(
      connection: IntegrationConnection,
      since?: Date
    ): Promise<WearableSleepData[]> {
      const startDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const uploadStartTime = Math.floor(startDate.getTime() / 1000);
      const uploadEndTime = Math.floor(endDate.getTime() / 1000);

      const url = `${baseUrl}/sleeps?uploadStartTimeInSeconds=${uploadStartTime}&uploadEndTimeInSeconds=${uploadEndTime}`;
      
      const accessToken = connection.tokens.accessToken;
      const tokenSecret = connection.tokens.refreshToken;

      const response = await makeOAuth1Request(
        'GET',
        url,
        accessToken,
        tokenSecret
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch Garmin sleep data: ${error}`);
      }

      const sleeps: GarminSleep[] = await response.json();

      return sleeps.map((sleep) => {
        const totalSleep = sleep.sleepTimeSeconds || sleep.durationInSeconds;
        const stages = {
          deep: Math.round((sleep.deepSleepSeconds || 0) / 60),
          light: Math.round((sleep.lightSleepSeconds || 0) / 60),
          rem: Math.round((sleep.remSleepSeconds || 0) / 60),
          awake: Math.round((sleep.awakeSleepSeconds || 0) / 60),
        };

        // Calculate sleep efficiency/quality (1-5 scale)
        const efficiency = totalSleep / sleep.durationInSeconds;
        const quality = Math.min(5, Math.max(1, Math.round(efficiency * 5)));

        return {
          provider: 'garmin' as const,
          externalId: sleep.summaryId,
          userId: connection.userId,
          startTime: new Date(sleep.startTimeInSeconds * 1000).toISOString(),
          endTime: new Date(
            (sleep.startTimeInSeconds + sleep.durationInSeconds) * 1000
          ).toISOString(),
          duration: Math.round(totalSleep / 60),
          quality,
          stages,
          metadata: {
            validation: sleep.validation,
            calendarDate: sleep.calendarDate,
            unmeasurableSeconds: sleep.unmeasurableSleepSeconds,
            napSeconds: sleep.napTimeSeconds,
            source: 'garmin_connect',
          },
        };
      });
    },

    /**
     * Validate Garmin webhook signature
     */
    validateWebhook(payload: unknown, signature: string): boolean {
      // Garmin webhook validation
      // Note: Garmin uses different webhook mechanism
      // This is a placeholder for custom validation logic
      const expectedSignature = crypto
        .createHmac('sha256', consumerSecret!)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    },
  };
}

/**
 * Map Garmin activity types to human-readable names
 */
function mapGarminActivityType(type: string): string {
  const activityMap: Record<string, string> = {
    RUNNING: 'Running',
    CYCLING: 'Cycling',
    WALKING: 'Walking',
    SWIMMING: 'Swimming',
    HIKING: 'Hiking',
    STRENGTH_TRAINING: 'Strength Training',
    YOGA: 'Yoga',
    ELLIPTICAL: 'Elliptical',
    ROWING: 'Rowing',
    GOLF: 'Golf',
    TENNIS: 'Tennis',
    BASKETBALL: 'Basketball',
    SOCCER: 'Soccer',
    SKIING: 'Skiing',
    SNOWBOARDING: 'Snowboarding',
    PADDLING: 'Paddling',
    ROCK_CLIMBING: 'Rock Climbing',
    STAND_UP_PADDLEBOARDING: 'Stand Up Paddleboarding',
    DIVING: 'Diving',
    MULTI_SPORT: 'Multi-Sport',
    OTHER: 'Other',
  };

  return activityMap[type] || type;
}
