# Phase 4: Additional Integration Providers

## Overview

This document outlines the implementation specifications for 9 additional integration providers beyond Fitbit, covering wearables, healthcare EHR systems, and calendar services.

## Architecture Pattern

All adapters follow the standardized `IntegrationProviderAdapter` interface established in `packages/integrations/types.ts`:

```typescript
interface IntegrationProviderAdapter {
  provider: IntegrationProvider;
  category: IntegrationCategory;
  getAuthorizationUrl(redirectUri: string, state: string): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
  revokeAccess(accessToken: string): Promise<void>;
  syncActivities(connection: IntegrationConnection, since?: Date): Promise<WearableActivityData[]>;
  syncSleep(connection: IntegrationConnection, since?: Date): Promise<WearableSleepData[]>;
  validateWebhook(payload: unknown, signature: string): boolean;
}
```

## Wearable Integrations

### 1. Google Fit Adapter

**Provider**: `google_fit`  
**Category**: `wearable`  
**OAuth**: Google OAuth 2.0  
**Scopes**: `fitness.activity.read`, `fitness.sleep.read`, `fitness.heart_rate.read`

**API Endpoints**:
- Activities: `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`
- Sleep: `https://www.googleapis.com/fitness/v1/users/me/sessions`

**Data Mapping**:
```typescript
// Google Fit → WellnessOS Canonical
{
  startTimeMillis: number  → timestamp: ISO string
  endTimeMillis: number    → duration: minutes
  activityType: number     → activityType: string (map codes)
  calories: { fpVal: number } → calories: number
}
```

**Implementation File**: `packages/integrations/adapters/google-fit.ts`

**Environment Variables**:
```bash
GOOGLE_FIT_CLIENT_ID=your_client_id
GOOGLE_FIT_CLIENT_SECRET=your_client_secret
GOOGLE_FIT_WEBHOOK_SECRET=your_webhook_secret
```

---

### 2. Apple Health (HealthKit) Adapter

**Provider**: `apple_health`  
**Category**: `wearable`  
**Authentication**: CloudKit + HealthKit authorization  
**Data Types**: `HKQuantityType`, `HKWorkout`, `HKCategoryType`

**Special Considerations**:
- iOS app required for HealthKit access
- CloudKit for server-side sync
- Background delivery for real-time updates

**Data Mapping**:
```typescript
// HealthKit → WellnessOS Canonical
{
  workoutActivityType: HKWorkoutActivityType → activityType: string
  duration: TimeInterval → duration: minutes
  totalEnergyBurned: HKQuantity → calories: number
  totalDistance: HKQuantity → distance: meters
}
```

**Implementation File**: `packages/integrations/adapters/apple-health.ts`

**Environment Variables**:
```bash
APPLE_HEALTH_CONTAINER_ID=iCloud.com.wellnessos.health
APPLE_HEALTH_KEY_ID=your_key_id
APPLE_HEALTH_TEAM_ID=your_team_id
APPLE_HEALTH_PRIVATE_KEY=your_private_key
```

---

### 3. Garmin Connect Adapter

**Provider**: `garmin`  
**Category**: `wearable`  
**OAuth**: OAuth 1.0a  
**API**: Garmin Health API

**API Endpoints**:
- Activities: `https://apis.garmin.com/wellness-api/rest/activities`
- Sleep: `https://apis.garmin.com/wellness-api/rest/sleeps`
- Daily Summary: `https://apis.garmin.com/wellness-api/rest/dailies`

**Data Mapping**:
```typescript
// Garmin → WellnessOS Canonical
{
  summaryId: string → externalId: string
  activityType: string → activityType: string
  durationInSeconds: number → duration: minutes
  activeKilocalories: number → calories: number
  distanceInMeters: number → distance: meters
}
```

**Implementation File**: `packages/integrations/adapters/garmin.ts`

**Environment Variables**:
```bash
GARMIN_CONSUMER_KEY=your_consumer_key
GARMIN_CONSUMER_SECRET=your_consumer_secret
```

---

### 4. Whoop Adapter

**Provider**: `whoop`  
**Category**: `wearable`  
**OAuth**: OAuth 2.0  
**Focus**: Recovery, strain, sleep

**API Endpoints**:
- Recovery: `https://api.prod.whoop.com/developer/v1/recovery`
- Workouts: `https://api.prod.whoop.com/developer/v1/workout`
- Sleep: `https://api.prod.whoop.com/developer/v1/sleep`
- Cycles: `https://api.prod.whoop.com/developer/v1/cycle`

**Unique Metrics**:
- Recovery score (0-100)
- Strain score (0-21)
- HRV (heart rate variability)
- Sleep performance percentage

**Data Mapping**:
```typescript
// Whoop → WellnessOS Canonical
{
  workoutId: number → externalId: string
  sportId: number → activityType: string
  during: { bounds: string } → timestamp + duration
  score: { strain: number } → metadata: { strain }
}
```

**Implementation File**: `packages/integrations/adapters/whoop.ts`

**Environment Variables**:
```bash
WHOOP_CLIENT_ID=your_client_id
WHOOP_CLIENT_SECRET=your_client_secret
```

---

### 5. Oura Ring Adapter

**Provider**: `oura`  
**Category**: `wearable`  
**OAuth**: OAuth 2.0  
**Focus**: Sleep, readiness, activity

**API Endpoints**:
- Sleep: `https://api.ouraring.com/v2/usercollection/sleep`
- Activity: `https://api.ouraring.com/v2/usercollection/daily_activity`
- Readiness: `https://api.ouraring.com/v2/usercollection/daily_readiness`
- Workouts: `https://api.ouraring.com/v2/usercollection/workout`

**Unique Metrics**:
- Readiness score (0-100)
- Sleep score (0-100)
- Activity score (0-100)
- HRV balance

**Data Mapping**:
```typescript
// Oura → WellnessOS Canonical
{
  id: string → externalId: string
  day: string → timestamp: ISO string
  score: number → metadata: { score }
  total_sleep_duration: number → duration: minutes
  efficiency: number → quality: (efficiency / 100) * 5
}
```

**Implementation File**: `packages/integrations/adapters/oura.ts`

**Environment Variables**:
```bash
OURA_CLIENT_ID=your_client_id
OURA_CLIENT_SECRET=your_client_secret
```

---

## Healthcare (EHR/FHIR) Integrations

### 6. Epic FHIR Adapter

**Provider**: `epic_fhir`  
**Category**: `ehr`  
**Standard**: FHIR R4  
**Auth**: SMART on FHIR (OAuth 2.0)

**FHIR Resources**:
- Observation (vital signs, lab results)
- Condition (diagnoses)
- MedicationRequest (prescriptions)
- AllergyIntolerance
- Immunization

**API Endpoints**:
- Base: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/`
- Observations: `/Observation?patient={id}&category=vital-signs`
- Conditions: `/Condition?patient={id}`
- Medications: `/MedicationRequest?patient={id}`

**Data Mapping**:
```typescript
// FHIR Observation → WellnessOS
{
  resourceType: "Observation",
  code: { coding: [{ code, display }] },
  valueQuantity: { value, unit },
  effectiveDateTime: string
} → {
  type: "observation",
  code: string,
  value: number,
  unit: string,
  timestamp: ISO string
}
```

**Implementation File**: `packages/integrations/adapters/epic-fhir.ts`

**Environment Variables**:
```bash
EPIC_FHIR_CLIENT_ID=your_client_id
EPIC_FHIR_REDIRECT_URI=your_redirect_uri
```

---

### 7. Cerner FHIR Adapter

**Provider**: `cerner_fhir`  
**Category**: `ehr`  
**Standard**: FHIR DSTU2 / R4  
**Auth**: SMART on FHIR (OAuth 2.0)

**FHIR Resources**:
- Observation
- Condition
- MedicationOrder (DSTU2) / MedicationRequest (R4)
- AllergyIntolerance
- Procedure

**API Endpoints**:
- Base: `https://fhir-ehr-code.cerner.com/r4/{tenant}/`
- Observations: `/Observation?patient={id}`
- Conditions: `/Condition?patient={id}`

**Data Mapping**:
Similar to Epic FHIR with version-specific adjustments for DSTU2 vs R4.

**Implementation File**: `packages/integrations/adapters/cerner-fhir.ts`

**Environment Variables**:
```bash
CERNER_FHIR_CLIENT_ID=your_client_id
CERNER_FHIR_REDIRECT_URI=your_redirect_uri
CERNER_FHIR_VERSION=R4
```

---

## Calendar Integrations

### 8. Google Calendar Adapter

**Provider**: `google_calendar`  
**Category**: `calendar`  
**OAuth**: Google OAuth 2.0  
**Scopes**: `calendar.readonly` or `calendar`

**API Endpoints**:
- Events List: `https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
- Event Create: `POST /calendars/{calendarId}/events`
- Event Update: `PUT /calendars/{calendarId}/events/{eventId}`

**Use Cases**:
- Sync wellness appointments
- Schedule habit reminders
- Block time for wellness activities
- Integrate with coach scheduling

**Data Mapping**:
```typescript
// Google Calendar Event → WellnessOS
{
  id: string → externalId: string
  summary: string → title: string
  start: { dateTime: string } → startTime: ISO string
  end: { dateTime: string } → endTime: ISO string
  description: string → notes: string
}
```

**Implementation File**: `packages/integrations/adapters/google-calendar.ts`

**Environment Variables**:
```bash
GOOGLE_CALENDAR_CLIENT_ID=your_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret
```

---

### 9. Outlook Calendar Adapter

**Provider**: `outlook_calendar`  
**Category**: `calendar`  
**OAuth**: Microsoft OAuth 2.0  
**Scopes**: `Calendars.Read`, `Calendars.ReadWrite`

**API Endpoints**:
- Events List: `https://graph.microsoft.com/v1.0/me/events`
- Event Create: `POST /me/events`
- Event Update: `PATCH /me/events/{eventId}`

**Use Cases**:
Same as Google Calendar - wellness appointments, scheduling, habit reminders.

**Data Mapping**:
```typescript
// Outlook Event → WellnessOS
{
  id: string → externalId: string
  subject: string → title: string
  start: { dateTime: string, timeZone: string } → startTime: ISO string
  end: { dateTime: string, timeZone: string } → endTime: ISO string
  body: { content: string } → notes: string
}
```

**Implementation File**: `packages/integrations/adapters/outlook-calendar.ts`

**Environment Variables**:
```bash
OUTLOOK_CALENDAR_CLIENT_ID=your_client_id
OUTLOOK_CALENDAR_CLIENT_SECRET=your_client_secret
OUTLOOK_CALENDAR_TENANT_ID=your_tenant_id
```

---

## Implementation Checklist

### For Each Adapter

- [ ] Create adapter file in `packages/integrations/adapters/`
- [ ] Implement `IntegrationProviderAdapter` interface
- [ ] Add OAuth 2.0 authorization URL generation
- [ ] Implement token exchange
- [ ] Implement token refresh with retry logic
- [ ] Implement revoke access
- [ ] Implement data sync methods
- [ ] Add webhook signature validation
- [ ] Transform provider data to canonical format
- [ ] Add comprehensive error handling
- [ ] Add rate limit handling
- [ ] Add circuit breaker for provider outages
- [ ] Update `.env.example` with provider credentials
- [ ] Add provider to `IntegrationRegistry` initialization
- [ ] Document API requirements and setup
- [ ] Test OAuth flow end-to-end
- [ ] Test data sync functionality
- [ ] Verify data transformation accuracy

### Global Updates

- [ ] Update `packages/integrations/types.ts` (already has all 10 providers)
- [ ] Update Integration Registry to support all providers
- [ ] Add provider-specific error handling
- [ ] Update documentation with setup instructions
- [ ] Create provider comparison matrix
- [ ] Add integration health monitoring
- [ ] Implement background sync scheduler
- [ ] Add conflict resolution for overlapping data
- [ ] Create integration analytics dashboard

---

## Testing Strategy

### Unit Tests

```typescript
describe('GoogleFitAdapter', () => {
  it('should generate valid authorization URL', () => {});
  it('should exchange code for tokens', () => {});
  it('should refresh expired tokens', () => {});
  it('should sync activities', () => {});
  it('should transform Google Fit data to canonical format', () => {});
  it('should validate webhooks', () => {});
});
```

### Integration Tests

```typescript
describe('Integration End-to-End', () => {
  it('should complete OAuth flow for Google Fit', () => {});
  it('should sync last 7 days of activities', () => {});
  it('should handle token expiration and refresh', () => {});
  it('should publish domain events after sync', () => {});
});
```

### Provider-Specific Tests

Each adapter should have tests for:
- OAuth authorization flow
- Token management (exchange, refresh, revoke)
- Data sync (activities, sleep, health metrics)
- Data transformation accuracy
- Webhook validation
- Error handling (rate limits, provider outages)
- Circuit breaker functionality

---

## Security Considerations

### OAuth Token Storage

- All tokens encrypted at rest in Firestore
- Tokens never exposed in API responses
- Automatic token rotation before expiration
- Secure token revocation (both local and provider-side)

### FHIR/PHI Data

- HIPAA compliance required for EHR integrations
- PHI data classified as `DataClassification.PHI`
- Audit logging for all PHI access
- Patient consent required before data sync
- Data retention policies enforced

### Webhook Security

- HMAC signature validation for all webhooks
- Replay attack prevention with timestamp checks
- IP allowlisting where supported by provider
- Rate limiting on webhook endpoints

---

## Deployment Strategy

### Phase 1: Wearables (Weeks 1-2)
- Google Fit
- Apple Health
- Garmin
- Whoop
- Oura

### Phase 2: Healthcare (Weeks 3-4)
- Epic FHIR
- Cerner FHIR

### Phase 3: Calendar (Week 5)
- Google Calendar
- Outlook Calendar

### Phase 4: Enhancements (Week 6+)
- Background sync scheduler
- Webhook endpoints
- Conflict resolution
- Integration health dashboard

---

## Monitoring & Observability

### Metrics to Track

- Integration connection count (per provider)
- Sync success/failure rates
- Average sync duration
- Token refresh frequency
- Provider API error rates
- Circuit breaker trips
- Webhook delivery success
- Data transformation errors

### Alerts

- Provider API availability < 95%
- Token refresh failure rate > 5%
- Sync failure rate > 10%
- Circuit breaker open for > 5 minutes
- Webhook signature validation failures

---

## Cost Optimization

### API Rate Limits

| Provider | Rate Limit | Cost |
|----------|------------|------|
| Google Fit | 10,000 req/day | Free |
| Apple Health | CloudKit limits | $0.40/GB |
| Garmin | 1,000 req/day | Free tier |
| Whoop | 100 req/min | Free |
| Oura | 5,000 req/day | Free |
| Epic FHIR | Varies by org | Usually free |
| Cerner FHIR | Varies by org | Usually free |
| Google Calendar | 1M req/day | Free |
| Outlook Calendar | Varies | Microsoft 365 included |

### Optimization Strategies

- Incremental sync (only fetch new data)
- Batch API requests where possible
- Cache frequently accessed data
- Use webhooks instead of polling
- Implement exponential backoff
- Circuit breaker to avoid hammering failing providers

---

## Migration Path

If migrating from existing integrations:

1. **Data Mapping**: Map old format to canonical `WearableActivityData` / `WearableSleepData`
2. **Backfill**: Sync historical data (with user consent)
3. **Dual-Write**: Write to both old and new systems temporarily
4. **Validation**: Compare outputs between systems
5. **Cutover**: Switch reads to new system
6. **Deprecation**: Remove old integration code

---

## Next Steps

1. Implement Google Fit adapter (highest Android market share)
2. Implement Apple Health adapter (highest iOS market share)
3. Implement remaining wearable adapters
4. Implement FHIR adapters for healthcare integration
5. Implement calendar adapters for scheduling
6. Build background sync scheduler
7. Add webhook endpoints for real-time updates
8. Create integration health dashboard
9. Comprehensive end-to-end testing
10. Production deployment with monitoring

---

## References

- [Google Fit API Documentation](https://developers.google.com/fit)
- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [Garmin Health API](https://developer.garmin.com/health-api/)
- [Whoop API Documentation](https://developer.whoop.com/)
- [Oura API Documentation](https://cloud.ouraring.com/docs/)
- [Epic FHIR Documentation](https://fhir.epic.com/)
- [Cerner FHIR Documentation](https://fhir.cerner.com/)
- [Google Calendar API](https://developers.google.com/calendar)
- [Microsoft Graph Calendar API](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [SMART on FHIR Specification](http://www.hl7.org/fhir/smart-app-launch/)
