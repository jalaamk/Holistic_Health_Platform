/**
 * Google Fit Integration Adapter
 * 
 * Implementation of IntegrationProviderAdapter for Google Fit API.
 * Handles OAuth 2.0 flow, data syncing for Android wearable ecosystem.
 */

import crypto from 'crypto';
import type {
  IntegrationProviderAdapter,
  IntegrationConnection,
  OAuthTokens,
  WearableActivityData,
  WearableSleepData,
} from '../types';

// Google Fit API configuration
const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2';
const GOOGLE_API_BASE = 'https://www.googleapis.com/fitness/v1';

// Activity type mapping (Google Fit activity codes → readable names)
const ACTIVITY_TYPE_MAP: Record<number, string> = {
  0: 'In vehicle',
  1: 'Biking',
  2: 'Still',
  3: 'Unknown',
  4: 'Tilting',
  5: 'Walking',
  7: 'Running',
  8: 'Aerobics',
  9: 'Badminton',
  10: 'Baseball',
  11: 'Basketball',
  12: 'Biathlon',
  13: 'Handball',
  14: 'Running (jogging)',
  15: 'Running (sand)',
  16: 'Running (treadmill)',
  17: 'Wheelchair',
  18: 'Wheelchair (athletics)',
  19: 'Rock climbing',
  20: 'Dancing',
  21: 'Elliptical',
  22: 'Ergometer',
  23: 'Escalator',
  26: 'Frisbee',
  27: 'Gardening',
  28: 'Golf',
  29: 'Gymnastics',
  32: 'Hiking',
  33: 'Hockey',
  34: 'Horseback riding',
  35: 'Housework',
  36: 'Ice skating',
  38: 'Jumping rope',
  39: 'Kayaking',
  40: 'Kettlebell training',
  41: 'Kickboxing',
  42: 'Kitesurfing',
  43: 'Martial arts',
  44: 'Meditation',
  45: 'Mixed martial arts',
  47: 'Paddle boarding',
  48: 'Paragliding',
  49: 'Pilates',
  50: 'Polo',
  51: 'Racquetball',
  52: 'Rock climbing',
  53: 'Rowing',
  54: 'Rowing machine',
  55: 'Rugby',
  56: 'Jogging',
  57: 'Running',
  58: 'Running (treadmill)',
  59: 'Sailing',
  60: 'Scuba diving',
  61: 'Skateboarding',
  62: 'Skating',
  63: 'Skiing',
  64: 'Skiing (back-country)',
  65: 'Skiing (cross-country)',
  66: 'Skiing (downhill)',
  67: 'Skiing (kite)',
  68: 'Skiing (roller)',
  69: 'Sledding',
  70: 'Sleep',
  71: 'Light sleep',
  72: 'Deep sleep',
  73: 'REM sleep',
  74: 'Awake (during sleep cycle)',
  75: 'Snowboarding',
  76: 'Snowmobile',
  77: 'Snowshoeing',
  78: 'Squash',
  79: 'Stair climbing',
  80: 'Stair climbing machine',
  81: 'Stand-up paddleboarding',
  82: 'Still (not moving)',
  83: 'Strength training',
  84: 'Surfing',
  85: 'Swimming',
  86: 'Swimming (open water)',
  87: 'Swimming (swimming pool)',
  88: 'Table tennis',
  89: 'Team sports',
  90: 'Tennis',
  91: 'Treadmill',
  92: 'Volleyball',
  93: 'Volleyball (beach)',
  94: 'Volleyball (indoor)',
  95: 'Wakeboarding',
  96: 'Walking',
  97: 'Walking (fitness)',
  98: 'Walking (nordic)',
  99: 'Walking (treadmill)',
  100: 'Walking (stroller)',
  101: 'Waterpolo',
  102: 'Weightlifting',
  103: 'Wheelchair',
  104: 'Windsurfing',
  105: 'Yoga',
  106: 'Zumba',
  108: 'Diving',
  109: 'Ergometer',
  110: 'Ice skating',
  111: 'Indoor skating',
  112: 'Curling',
  113: 'Other',
};

interface GoogleFitConfig {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}

export class GoogleFitAdapter implements IntegrationProviderAdapter {
  provider = 'google_fit' as const;
  category = 'wearable' as const;
  
  private config: GoogleFitConfig;

  constructor(config: GoogleFitConfig) {
    this.config = config;
  }

  // OAuth Flow

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: [
        'https://www.googleapis.com/auth/fitness.activity.read',
        'https://www.googleapis.com/auth/fitness.sleep.read',
        'https://www.googleapis.com/auth/fitness.heart_rate.read',
        'https://www.googleapis.com/auth/fitness.body.read',
        'https://www.googleapis.com/auth/fitness.location.read',
      ].join(' '),
      state,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen to get refresh token
    });

    return `${GOOGLE_OAUTH_BASE}/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokens> {
    const response = await fetch(`${GOOGLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Google Fit OAuth failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000
      ).toISOString(),
      scope: data.scope ? data.scope.split(' ') : [],
      tokenType: data.token_type,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(`${GOOGLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Google Fit token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Google doesn't return new refresh token
      expiresAt: new Date(
        Date.now() + data.expires_in * 1000
      ).toISOString(),
      scope: data.scope ? data.scope.split(' ') : [],
      tokenType: data.token_type,
    };
  }

  async revokeAccess(accessToken: string): Promise<void> {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
      {
        method: 'POST',
      }
    );

    if (!response.ok) {
      throw new Error(`Google Fit revoke failed: ${response.statusText}`);
    }
  }

  // Data Syncing

  async syncActivities(
    connection: IntegrationConnection,
    since?: Date
  ): Promise<WearableActivityData[]> {
    const endTime = Date.now();
    const startTime = since ? since.getTime() : endTime - 24 * 60 * 60 * 1000; // Default: last 24 hours

    // Aggregate activity data
    const response = await fetch(
      `${GOOGLE_API_BASE}/users/me/dataset:aggregate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [
            {
              dataTypeName: 'com.google.activity.segment',
            },
            {
              dataTypeName: 'com.google.calories.expended',
            },
            {
              dataTypeName: 'com.google.distance.delta',
            },
            {
              dataTypeName: 'com.google.heart_rate.bpm',
            },
          ],
          bucketByTime: { durationMillis: 3600000 }, // 1 hour buckets
          startTimeMillis: startTime,
          endTimeMillis: endTime,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google Fit activities fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    const activities: WearableActivityData[] = [];

    if (data.bucket) {
      for (const bucket of data.bucket) {
        const activitySegment = bucket.dataset?.find(
          (ds: any) => ds.dataSourceId.includes('activity.segment')
        );
        const caloriesData = bucket.dataset?.find(
          (ds: any) => ds.dataSourceId.includes('calories.expended')
        );
        const distanceData = bucket.dataset?.find(
          (ds: any) => ds.dataSourceId.includes('distance.delta')
        );
        const heartRateData = bucket.dataset?.find(
          (ds: any) => ds.dataSourceId.includes('heart_rate.bpm')
        );

        if (activitySegment?.point) {
          for (const point of activitySegment.point) {
            const activityType = point.value[0]?.intVal;
            const startTimeNanos = parseInt(point.startTimeNanos);
            const endTimeNanos = parseInt(point.endTimeNanos);
            const durationMs = (endTimeNanos - startTimeNanos) / 1000000;

            // Get calories for this time period
            const calories = caloriesData?.point?.find(
              (p: any) =>
                p.startTimeNanos === point.startTimeNanos
            )?.value[0]?.fpVal || 0;

            // Get distance for this time period
            const distance = distanceData?.point?.find(
              (p: any) =>
                p.startTimeNanos === point.startTimeNanos
            )?.value[0]?.fpVal || 0;

            // Calculate average heart rate
            const heartRatePoints = heartRateData?.point?.filter(
              (p: any) =>
                parseInt(p.startTimeNanos) >= startTimeNanos &&
                parseInt(p.startTimeNanos) <= endTimeNanos
            ) || [];
            
            let avgHeartRate: number | undefined;
            if (heartRatePoints.length > 0) {
              const sum = heartRatePoints.reduce(
                (acc: number, p: any) => acc + (p.value[0]?.fpVal || 0),
                0
              );
              avgHeartRate = Math.round(sum / heartRatePoints.length);
            }

            activities.push({
              provider: 'google_fit',
              externalId: `${startTimeNanos}`,
              userId: connection.userId,
              timestamp: new Date(startTimeNanos / 1000000).toISOString(),
              activityType: ACTIVITY_TYPE_MAP[activityType] || 'Unknown',
              duration: Math.round(durationMs / 60000), // ms to minutes
              distance: distance > 0 ? Math.round(distance) : undefined, // meters
              calories: calories > 0 ? Math.round(calories) : undefined,
              heartRate: avgHeartRate
                ? {
                    average: avgHeartRate,
                    min: 0,
                    max: 0,
                  }
                : undefined,
              metadata: {
                activityTypeCode: activityType,
                source: 'google_fit',
              },
            });
          }
        }
      }
    }

    return activities;
  }

  async syncSleep(
    connection: IntegrationConnection,
    since?: Date
  ): Promise<WearableSleepData[]> {
    const endTime = Date.now();
    const startTime = since ? since.getTime() : endTime - 7 * 24 * 60 * 60 * 1000; // Default: last 7 days

    // Fetch sleep sessions
    const response = await fetch(
      `${GOOGLE_API_BASE}/users/me/sessions?startTime=${new Date(startTime).toISOString()}&endTime=${new Date(endTime).toISOString()}`,
      {
        headers: {
          Authorization: `Bearer ${connection.tokens.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Fit sleep fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    const sleepData: WearableSleepData[] = [];

    if (data.session) {
      for (const session of data.session) {
        // Filter for sleep sessions (activity type 72)
        if (session.activityType === 72) {
          const startTimeMs = parseInt(session.startTimeMillis);
          const endTimeMs = parseInt(session.endTimeMillis);
          const durationMs = endTimeMs - startTimeMs;

          // Fetch sleep stages data for this session
          const stagesResponse = await fetch(
            `${GOOGLE_API_BASE}/users/me/dataset:aggregate`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${connection.tokens.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                aggregateBy: [
                  {
                    dataTypeName: 'com.google.sleep.segment',
                  },
                ],
                startTimeMillis: startTimeMs,
                endTimeMillis: endTimeMs,
              }),
            }
          );

          let stages;
          if (stagesResponse.ok) {
            const stagesData = await stagesResponse.json();
            const sleepSegments = stagesData.bucket?.[0]?.dataset?.[0]?.point || [];

            let deepMinutes = 0;
            let lightMinutes = 0;
            let remMinutes = 0;
            let awakeMinutes = 0;

            for (const point of sleepSegments) {
              const sleepType = point.value[0]?.intVal;
              const pointDurationMs = (parseInt(point.endTimeNanos) - parseInt(point.startTimeNanos)) / 1000000;
              const pointDurationMinutes = Math.round(pointDurationMs / 60000);

              // Sleep type codes: 71 (light), 72 (deep), 73 (REM), 74 (awake)
              if (sleepType === 71) lightMinutes += pointDurationMinutes;
              else if (sleepType === 72) deepMinutes += pointDurationMinutes;
              else if (sleepType === 73) remMinutes += pointDurationMinutes;
              else if (sleepType === 74) awakeMinutes += pointDurationMinutes;
            }

            if (deepMinutes > 0 || lightMinutes > 0 || remMinutes > 0) {
              stages = {
                deep: deepMinutes,
                light: lightMinutes,
                rem: remMinutes,
                awake: awakeMinutes,
              };
            }
          }

          // Calculate sleep quality (efficiency score)
          const totalSleepMinutes = Math.round(durationMs / 60000);
          const awakeTime = stages?.awake || 0;
          const efficiency = totalSleepMinutes > 0
            ? Math.round(((totalSleepMinutes - awakeTime) / totalSleepMinutes) * 100)
            : 0;

          sleepData.push({
            provider: 'google_fit',
            externalId: session.id || `${startTimeMs}`,
            userId: connection.userId,
            startTime: new Date(startTimeMs).toISOString(),
            endTime: new Date(endTimeMs).toISOString(),
            duration: totalSleepMinutes,
            quality: Math.min(Math.round(efficiency / 20), 5), // Convert 0-100 to 1-5 scale
            stages,
            metadata: {
              efficiency,
              sessionName: session.name,
              application: session.application?.packageName,
            },
          });
        }
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
      .digest('hex');

    return signature === expectedSignature;
  }
}

// Factory function for creating Google Fit adapter
export function createGoogleFitAdapter(): GoogleFitAdapter {
  const config: GoogleFitConfig = {
    clientId: process.env.GOOGLE_FIT_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_FIT_CLIENT_SECRET || '',
    webhookSecret: process.env.GOOGLE_FIT_WEBHOOK_SECRET || '',
  };

  if (!config.clientId || !config.clientSecret) {
    console.warn('[GoogleFitAdapter] Missing configuration - integration will not work');
  }

  return new GoogleFitAdapter(config);
}
