/**
 * Apple Health (HealthKit) Integration Adapter
 * 
 * Implementation of IntegrationProviderAdapter for Apple HealthKit via CloudKit.
 * Handles iOS app authorization and server-side data syncing.
 * 
 * Note: This adapter requires an iOS app with HealthKit entitlements.
 * The iOS app handles user authorization and syncs data to CloudKit.
 * This server-side adapter reads from CloudKit for backend processing.
 */

import crypto from 'crypto';
import type {
  IntegrationProviderAdapter,
  IntegrationConnection,
  OAuthTokens,
  WearableActivityData,
  WearableSleepData,
} from '../types';

// CloudKit configuration
const CLOUDKIT_API_BASE = 'https://api.apple-cloudkit.com';

// HealthKit workout type mapping
const WORKOUT_TYPE_MAP: Record<number, string> = {
  1: 'AmericanFootball',
  2: 'Archery',
  3: 'AustralianFootball',
  4: 'Badminton',
  5: 'Baseball',
  6: 'Basketball',
  7: 'Bowling',
  8: 'Boxing',
  9: 'Climbing',
  10: 'Cricket',
  11: 'CrossTraining',
  12: 'Curling',
  13: 'Cycling',
  14: 'Dance',
  16: 'Elliptical',
  17: 'EquestrianSports',
  18: 'Fencing',
  19: 'Fishing',
  20: 'FunctionalStrengthTraining',
  21: 'Golf',
  22: 'Gymnastics',
  23: 'Handball',
  24: 'Hiking',
  25: 'Hockey',
  26: 'Hunting',
  27: 'Lacrosse',
  28: 'MartialArts',
  29: 'MindAndBody',
  31: 'PaddleSports',
  32: 'Play',
  33: 'PreparationAndRecovery',
  34: 'Racquetball',
  35: 'Rowing',
  36: 'Rugby',
  37: 'Running',
  38: 'Sailing',
  39: 'SkatingSports',
  40: 'SnowSports',
  41: 'Soccer',
  42: 'Softball',
  43: 'Squash',
  44: 'StairClimbing',
  45: 'SurfingSports',
  46: 'Swimming',
  47: 'TableTennis',
  48: 'Tennis',
  49: 'TrackAndField',
  50: 'TraditionalStrengthTraining',
  51: 'Volleyball',
  52: 'Walking',
  53: 'WaterFitness',
  54: 'WaterPolo',
  55: 'WaterSports',
  56: 'Wrestling',
  57: 'Yoga',
  58: 'Barre',
  59: 'CoreTraining',
  60: 'CrossCountrySkiing',
  61: 'DownhillSkiing',
  62: 'Flexibility',
  63: 'HighIntensityIntervalTraining',
  64: 'JumpRope',
  65: 'Kickboxing',
  66: 'Pilates',
  67: 'Snowboarding',
  68: 'Stairs',
  69: 'StepTraining',
  70: 'WheelchairWalkPace',
  71: 'WheelchairRunPace',
  72: 'TaiChi',
  73: 'MixedCardio',
  74: 'HandCycling',
  3000: 'Other',
};

interface AppleHealthConfig {
  containerId: string; // CloudKit container ID
  keyId: string; // Apple Developer key ID
  teamId: string; // Apple Developer team ID
  privateKey: string; // Private key for signing requests
}

export class AppleHealthAdapter implements IntegrationProviderAdapter {
  provider = 'apple_health' as const;
  category = 'wearable' as const;
  
  private config: AppleHealthConfig;

  constructor(config: AppleHealthConfig) {
    this.config = config;
  }

  // OAuth Flow (simplified - actual auth happens in iOS app)
  // These methods provide compatibility with the adapter interface

  getAuthorizationUrl(redirectUri: string, state: string): string {
    // Apple Health doesn't have a traditional web OAuth flow
    // Authorization happens natively in the iOS app
    // Return a deep link to the iOS app to initiate HealthKit authorization
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      state,
    });

    return `wellnessos://authorize/apple-health?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokens> {
    // For Apple Health, the "code" is actually a CloudKit user token
    // provided by the iOS app after successful HealthKit authorization
    
    // Verify the token with CloudKit
    const response = await this.callCloudKit(
      `/database/1/${this.config.containerId}/development/public/users/current`,
      'GET',
      code
    );

    if (!response.ok) {
      throw new Error(`Apple Health authorization failed: ${response.statusText}`);
    }

    const userData = await response.json();

    // Create a pseudo-OAuth token structure
    // The CloudKit user token serves as our "access token"
    return {
      accessToken: code,
      refreshToken: code, // CloudKit tokens are long-lived
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      scope: ['health.read'],
      tokenType: 'CloudKit',
      metadata: {
        cloudKitUserId: userData.userRecordName,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    // CloudKit tokens are long-lived and don't need refresh
    // Just verify the token is still valid
    const response = await this.callCloudKit(
      `/database/1/${this.config.containerId}/development/public/users/current`,
      'GET',
      refreshToken
    );

    if (!response.ok) {
      throw new Error(`Apple Health token validation failed: ${response.statusText}`);
    }

    return {
      accessToken: refreshToken,
      refreshToken: refreshToken,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      scope: ['health.read'],
      tokenType: 'CloudKit',
    };
  }

  async revokeAccess(accessToken: string): Promise<void> {
    // Revocation happens in the iOS app by the user
    // Server-side, we just mark the connection as revoked in our system
    // (This is handled by the IntegrationRegistry, not the adapter)
    console.log('[AppleHealthAdapter] Revocation must be done in iOS app');
  }

  // CloudKit API helper

  private async callCloudKit(
    path: string,
    method: string,
    userToken: string,
    body?: any
  ): Promise<Response> {
    // Sign the request with Apple's server-to-server authentication
    const timestamp = new Date().toISOString();
    const signaturePayload = `${timestamp}:${path}:${method}`;
    
    // In production, use the private key to sign
    // For now, simplified signature (actual implementation would use crypto.sign)
    const signature = crypto
      .createHmac('sha256', this.config.privateKey)
      .update(signaturePayload)
      .digest('base64');

    const headers: Record<string, string> = {
      'X-Apple-CloudKit-Request-KeyID': this.config.keyId,
      'X-Apple-CloudKit-Request-ISO8601Date': timestamp,
      'X-Apple-CloudKit-Request-SignatureV1': signature,
      'X-CloudKit-User-Token': userToken,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(`${CLOUDKIT_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // Data Syncing

  async syncActivities(
    connection: IntegrationConnection,
    since?: Date
  ): Promise<WearableActivityData[]> {
    const startDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

    // Query CloudKit for workout records synced from HealthKit
    const response = await this.callCloudKit(
      `/database/1/${this.config.containerId}/development/private/records/query`,
      'POST',
      connection.tokens.accessToken,
      {
        query: {
          recordType: 'HKWorkout',
          filterBy: [
            {
              fieldName: 'startDate',
              comparator: 'GREATER_THAN',
              fieldValue: {
                value: startDate.getTime(),
                type: 'TIMESTAMP',
              },
            },
          ],
          sortBy: [
            {
              fieldName: 'startDate',
              ascending: false,
            },
          ],
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Apple Health activities fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    const activities: WearableActivityData[] = [];

    if (data.records) {
      for (const record of data.records) {
        const fields = record.fields;
        const workoutType = fields.workoutActivityType?.value;
        const startDate = new Date(fields.startDate?.value);
        const endDate = new Date(fields.endDate?.value);
        const duration = (endDate.getTime() - startDate.getTime()) / 60000; // minutes

        activities.push({
          provider: 'apple_health',
          externalId: record.recordName,
          userId: connection.userId,
          timestamp: startDate.toISOString(),
          activityType: WORKOUT_TYPE_MAP[workoutType] || 'Other',
          duration: Math.round(duration),
          distance: fields.totalDistance?.value
            ? Math.round(fields.totalDistance.value)
            : undefined, // meters
          calories: fields.totalEnergyBurned?.value
            ? Math.round(fields.totalEnergyBurned.value)
            : undefined,
          heartRate: fields.averageHeartRate?.value
            ? {
                average: Math.round(fields.averageHeartRate.value),
                min: fields.minHeartRate?.value
                  ? Math.round(fields.minHeartRate.value)
                  : 0,
                max: fields.maxHeartRate?.value
                  ? Math.round(fields.maxHeartRate.value)
                  : 0,
              }
            : undefined,
          metadata: {
            workoutTypeCode: workoutType,
            sourceBundle: fields.sourceBundleIdentifier?.value,
            device: fields.device?.value,
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
    const startDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    // Query CloudKit for sleep analysis records from HealthKit
    const response = await this.callCloudKit(
      `/database/1/${this.config.containerId}/development/private/records/query`,
      'POST',
      connection.tokens.accessToken,
      {
        query: {
          recordType: 'HKCategoryType.SleepAnalysis',
          filterBy: [
            {
              fieldName: 'startDate',
              comparator: 'GREATER_THAN',
              fieldValue: {
                value: startDate.getTime(),
                type: 'TIMESTAMP',
              },
            },
          ],
          sortBy: [
            {
              fieldName: 'startDate',
              ascending: false,
            },
          ],
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Apple Health sleep fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Group sleep samples by session
    const sleepSessions = new Map<string, any[]>();

    if (data.records) {
      for (const record of data.records) {
        const fields = record.fields;
        const startDate = new Date(fields.startDate?.value);
        const sessionKey = startDate.toISOString().split('T')[0]; // Group by date

        if (!sleepSessions.has(sessionKey)) {
          sleepSessions.set(sessionKey, []);
        }

        sleepSessions.get(sessionKey)!.push({
          id: record.recordName,
          startDate,
          endDate: new Date(fields.endDate?.value),
          value: fields.value?.value, // 0: InBed, 1: Asleep, 2: Awake, 3: Core, 4: Deep, 5: REM
        });
      }
    }

    const sleepData: WearableSleepData[] = [];

    // Convert grouped sessions to our format
    for (const [sessionKey, samples] of sleepSessions.entries()) {
      if (samples.length === 0) continue;

      // Sort by start date
      samples.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      const sessionStart = samples[0].startDate;
      const sessionEnd = samples[samples.length - 1].endDate;
      const totalDurationMs = sessionEnd.getTime() - sessionStart.getTime();

      // Calculate stage durations
      let deepMinutes = 0;
      let coreMinutes = 0;
      let remMinutes = 0;
      let awakeMinutes = 0;

      for (const sample of samples) {
        const sampleDurationMs = sample.endDate.getTime() - sample.startDate.getTime();
        const sampleDurationMinutes = Math.round(sampleDurationMs / 60000);

        // Sleep value codes: 0=InBed, 1=Asleep, 2=Awake, 3=Core, 4=Deep, 5=REM
        if (sample.value === 4) deepMinutes += sampleDurationMinutes;
        else if (sample.value === 3) coreMinutes += sampleDurationMinutes; // Core = Light
        else if (sample.value === 5) remMinutes += sampleDurationMinutes;
        else if (sample.value === 2) awakeMinutes += sampleDurationMinutes;
      }

      // Calculate sleep quality
      const totalSleepMinutes = Math.round(totalDurationMs / 60000);
      const actualSleepMinutes = totalSleepMinutes - awakeMinutes;
      const efficiency = totalSleepMinutes > 0
        ? Math.round((actualSleepMinutes / totalSleepMinutes) * 100)
        : 0;

      sleepData.push({
        provider: 'apple_health',
        externalId: `sleep_${sessionKey}`,
        userId: connection.userId,
        startTime: sessionStart.toISOString(),
        endTime: sessionEnd.toISOString(),
        duration: totalSleepMinutes,
        quality: Math.min(Math.round(efficiency / 20), 5), // Convert 0-100 to 1-5 scale
        stages: {
          deep: deepMinutes,
          light: coreMinutes, // Core sleep maps to light sleep
          rem: remMinutes,
          awake: awakeMinutes,
        },
        metadata: {
          efficiency,
          sampleCount: samples.length,
        },
      });
    }

    return sleepData;
  }

  // Webhook Validation
  // Note: Apple Health doesn't use webhooks - data is pushed from iOS app to CloudKit

  validateWebhook(payload: unknown, signature: string): boolean {
    // Not applicable for Apple Health/CloudKit
    // Data changes are detected via CloudKit subscriptions in the iOS app
    return false;
  }
}

// Factory function for creating Apple Health adapter
export function createAppleHealthAdapter(): AppleHealthAdapter {
  const config: AppleHealthConfig = {
    containerId: process.env.APPLE_HEALTH_CONTAINER_ID || '',
    keyId: process.env.APPLE_HEALTH_KEY_ID || '',
    teamId: process.env.APPLE_HEALTH_TEAM_ID || '',
    privateKey: process.env.APPLE_HEALTH_PRIVATE_KEY || '',
  };

  if (!config.containerId || !config.keyId || !config.teamId || !config.privateKey) {
    console.warn('[AppleHealthAdapter] Missing configuration - integration will not work');
  }

  return new AppleHealthAdapter(config);
}
