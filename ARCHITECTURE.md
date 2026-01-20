# WellnessOS Architecture Blueprint

## Executive Summary

WellnessOS is an enterprise-grade holistic health platform designed from the ground up with operating system principles. It prioritizes:

1. **Portability**: Provider abstractions enable migration from Firebase/OpenAI to enterprise solutions without rewrites
2. **Compliance**: HIPAA/GDPR readiness with consent gates, audit logging, and data classification
3. **Scalability**: Event-driven architecture with multi-tenancy support
4. **Maintainability**: Contract-first development with OpenAPI/AsyncAPI schemas
5. **Security**: Defense in depth with authentication, authorization, entitlements, and encryption

## Architectural Layers

### Layer 1: Core OS (Tier A)

Foundation services that all other layers depend on:

- **Identity & Access OS**: User authentication, session management, MFA
- **Profile Spine OS**: Canonical source of truth for user state
- **Policy & Consent OS**: Runtime policy enforcement and consent management
- **Event Bus**: Event-driven integration with outbox pattern and idempotency
- **Entitlements & Quotas OS**: Feature gating and usage limits
- **Observability**: Structured logging, metrics, and distributed tracing
- **Security/Audit**: Immutable audit log and data classification

### Layer 2: Domain OS (Tier B)

Business logic organized by health domains:

- **Nutrition OS**: Meal logging, calorie tracking, dietary goals
- **Movement OS**: Exercise tracking, fitness goals
- **Sleep OS**: Sleep sessions and quality analysis
- **Habits OS**: Habit tracking and streaks
- **Mind/Journal OS**: Journaling and mood tracking
- **Social/Community OS**: Social features and sharing

### Layer 3: Composition Layer (BFF)

Backend-for-Frontend endpoints that compose domain data:

- **Screen ViewModels**: One endpoint per screen, pre-composed data
- **Policy Filtering**: Applied at BFF layer
- **Caching**: Projection stores for performance

### Layer 4: Client Applications

- **Web App**: Admin, professional suite, and authoring tools
- **Mobile App**: Today view, logging, offline support

### Cross-Cutting Concerns (Tier C)

Enterprise capabilities built on Tier A/B foundation:

- **AI Orchestrator**: Prompt registry, quota enforcement, explainability
- **Integrations Hub**: Wearables, EHR, calendar sync
- **Payments & Billing**: Subscription management
- **Professional Suite**: Coach/clinic tools
- **Enterprise Console**: SSO/SCIM, compliance dashboards

## Design Patterns

### 1. Provider Pattern (Portability)

All external dependencies accessed through interfaces:

```typescript
interface IdentityProvider {
  verifyToken(token: string): Promise<TokenPayload>;
  createUser(params: CreateUserParams): Promise<User>;
  // ...
}
```

Current implementation: Firebase Auth
Future options: WorkOS, Auth0, Okta, Keycloak

### 2. BFF Pattern (Performance)

Each screen is one API call returning a complete ViewModel:

```
GET /api/bff/screens/today
→ Returns: profile + planItems + habits + timeline + rewards + notifications
```

Benefits:
- Reduces client roundtrips
- Policy filtering at edge
- Optimized for client needs

### 3. Event-Driven Architecture (Decoupling)

Domains publish events, projections subscribe:

```
Habits OS: habits.completed →
  ├─ Timeline OS: Add timeline item
  ├─ Rewards OS: Update streak
  └─ Analytics: Track engagement
```

Benefits:
- No cross-domain DB queries
- Independent scaling
- Audit trail by default

### 4. Profile Spine (Single Source of Truth)

Canonical store for:
- Identity and preferences
- Consent records
- Computed summaries (with explainability)

Updated via patch operations with optimistic concurrency:

```typescript
{
  version: 42,
  operations: [
    { op: 'set', path: '/preferences/theme', value: 'dark' }
  ]
}
```

### 5. Consent Gates (Privacy by Design)

Every data access and AI action checks consent:

```typescript
// In AI Orchestrator
if (!hasConsent(userId, 'ai_coach')) {
  throw new ForbiddenError('AI features require consent');
}
```

Consent scopes:
- nutrition, movement, sleep, habits, journal
- sensors, ai_coach, analytics, sharing
- integrations, professional_access, research

### 6. Explainability (Trust)

All computed scores include:
- Reason codes (human-readable explanations)
- Confidence level (0-1)
- Evidence pack (data points used)

Example:
```json
{
  "adherenceScore": 85,
  "confidence": 0.92,
  "reasonCodes": [
    "7_day_habit_streak",
    "consistent_meal_logging",
    "sleep_target_met"
  ],
  "evidence": {
    "dataPoints": [...]
  }
}
```

## Data Flow Examples

### Write Flow: User Logs a Meal

1. Client → BFF: `POST /api/nutrition/meals`
2. BFF validates input and entitlements
3. Nutrition OS saves meal to domain store
4. Nutrition OS publishes `nutrition.meal.logged` event
5. Event consumers update projections:
   - Timeline OS: Add timeline item
   - Analytics: Update nutrition metrics
   - Rewards OS: Check if goal met

### Read Flow: Today Screen

1. Client → BFF: `GET /api/bff/screens/today`
2. BFF fetches data from multiple projections in parallel:
   - Profile Spine: User preferences
   - Plan OS: Today's plan items
   - Habits OS: Today's habits
   - Timeline OS: Recent activity
   - Rewards OS: Points and streaks
3. BFF applies policy filtering
4. BFF returns composed ViewModel

### AI Flow: Generate Insight

1. Client → BFF: `POST /api/ai/insights`
2. BFF checks consent scope `ai_coach`
3. BFF checks AI quota remaining
4. AI Orchestrator loads prompt from registry
5. AI Provider generates completion (with telemetry)
6. AI Orchestrator adds explainability metadata
7. Audit log records AI usage
8. Return insight with reason codes

## Security Model

### Authentication

- JWT tokens with short expiration
- Refresh tokens with rotation
- MFA required for org-admin and pro roles

### Authorization

Layered checks:
1. **Authentication**: Valid token
2. **Entitlements**: Feature enabled for tenant
3. **Quotas**: Usage within limits
4. **Policy**: Action allowed by policy
5. **Consent**: User granted consent scope

### Data Classification

Every record tagged:
- `public`: Shareable
- `internal`: Within tenant only
- `sensitive`: PII, requires protection
- `phi`: Protected health info, HIPAA controls

### Audit Logging

Immutable log of:
- All writes to sensitive data
- Policy decisions
- Consent changes
- AI actions
- Export/delete requests (DSR)

## Multi-Tenancy

### Tenant Tiers

- **Consumer**: Free tier, basic features
- **Pro**: Paid tier, AI + integrations + client management
- **Enterprise**: SSO/SCIM, custom policies, API access

### Isolation

- Logical isolation via `tenantId` in all queries
- RLS (Row Level Security) when using Postgres
- Separate compliance policies per tenant

### Org Roles

- `org-admin`: Manages organization
- `pro`: Professional (coach, therapist)
- `staff`: Organization staff
- `member`: Regular user
- `viewer`: Read-only access
- `support`: Customer support (scoped)

## Observability

### Structured Logging

All logs include:
```json
{
  "requestId": "uuid",
  "traceId": "w3c-trace-id",
  "tenantId": "uuid",
  "userId": "uuid",
  "route": "/api/bff/screens/today",
  "method": "GET",
  "status": 200,
  "latencyMs": 45,
  "timestamp": "2026-01-20T18:00:00Z"
}
```

### Metrics

- Golden signals: Latency, errors, throughput, saturation
- Business metrics: DAU, feature usage, conversion
- Cost metrics: AI tokens, storage, compute

### Distributed Tracing

W3C Trace Context propagated through:
- API calls
- Event publishing/consuming
- External service calls (Firebase, OpenAI)

## Implementation Phases

### Phase 0: Foundation (Weeks 0-2) ✅ IN PROGRESS

- [x] Project structure and tooling
- [x] TypeScript strict mode
- [x] Environment validation
- [x] Provider interfaces
- [x] Core domain models
- [x] Event envelope and taxonomy
- [x] API handler abstraction
- [x] Entitlements service
- [x] OpenAPI contracts
- [x] AsyncAPI schemas
- [x] CI/CD pipeline
- [ ] Firebase adapters (Identity, DataStore)
- [ ] OpenAI adapter (AIProvider)

### Phase 1: Tier A Backbone (Weeks 2-6)

- [ ] Profile Spine implementation
- [ ] Policy & Consent service
- [ ] Event Bus (in-memory → Redis/Kafka)
- [ ] Outbox pattern
- [ ] Idempotency tracking
- [ ] BFF endpoints (3 screens)
- [ ] Timeline projection
- [ ] Rewards projection

### Phase 2: Domain Migration (Weeks 6-16)

- [ ] Habits OS (complete with events)
- [ ] Nutrition OS (complete with events)
- [ ] Sleep OS
- [ ] Movement OS
- [ ] Mind/Journal OS

### Phase 3: AI Orchestrator (Weeks 16-20)

- [ ] Prompt Registry
- [ ] Eval harness
- [ ] Quota enforcement
- [ ] Explainability framework
- [ ] AI Router (multi-provider)

### Phase 4: Enterprise Features (Weeks 20-30)

- [ ] Integrations Hub (1-2 providers)
- [ ] Payments & Billing
- [ ] Professional Suite MVP
- [ ] Enterprise Console MVP
- [ ] SSO/SCIM support

## Migration Strategy

### From Firebase to Enterprise

When to migrate:
- **Identity**: Enterprise customers need SSO/SCIM
- **Database**: Reporting queries become complex
- **AI**: Cost/compliance requires private deployment

How to migrate:
1. Implement new provider adapter
2. Feature flag new provider
3. Dual-write period for validation
4. Gradual rollout by tenant
5. Deprecate old provider

Provider abstraction ensures no application code changes needed.

## Success Metrics

### Technical

- Build time < 5 minutes
- All tests pass in CI
- TypeScript strict mode: 0 errors
- ESLint: 0 warnings
- Test coverage > 80%
- API p95 latency < 500ms

### Business

- User retention (30-day)
- Feature adoption rates
- AI interaction quality scores
- Professional user engagement
- Enterprise adoption

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-engineering | High | Start minimal, add when needed |
| Provider lock-in | High | Interfaces enforced from day 1 |
| Performance regression | Medium | SLOs + error budgets + monitoring |
| Compliance gaps | High | Regular audits + checklists |
| Scope creep | High | Phased delivery + MVP mindset |

## Decision Log

### ADR-001: Why Provider Abstractions?

**Context**: Need to ship fast but maintain enterprise path.

**Decision**: Abstract all external dependencies (Firebase, OpenAI) behind interfaces.

**Consequences**: 
- ✅ Can migrate providers without rewrites
- ✅ Testable (mock providers)
- ⚠️ Extra abstraction layer
- ⚠️ Must maintain adapters

**Status**: Accepted

### ADR-002: Why BFF Pattern?

**Context**: Mobile clients need optimal performance.

**Decision**: Screen-based ViewModels at BFF layer.

**Consequences**:
- ✅ Fewer client roundtrips
- ✅ Easier policy enforcement
- ✅ Optimized for client needs
- ⚠️ More endpoints to maintain
- ⚠️ Duplication if views overlap

**Status**: Accepted

### ADR-003: Why Event-Driven?

**Context**: Need loose coupling between domains.

**Decision**: Event bus with domain events.

**Consequences**:
- ✅ No cross-domain DB queries
- ✅ Audit trail by default
- ✅ Independent scaling
- ⚠️ Eventual consistency
- ⚠️ Event schema management overhead

**Status**: Accepted

## Glossary

- **BFF**: Backend-for-Frontend
- **PHI**: Protected Health Information
- **DSR**: Data Subject Request (GDPR)
- **RLS**: Row Level Security
- **SLO**: Service Level Objective
- **MFA**: Multi-Factor Authentication
- **SSO**: Single Sign-On
- **SCIM**: System for Cross-domain Identity Management

## References

- OpenAPI Contract: `contracts/openapi/bff.yaml`
- AsyncAPI Events: `contracts/asyncapi/events.yaml`
- Core Types: `packages/core/src/models/types.ts`
- Provider Interfaces: `packages/core/src/providers/interfaces.ts`
- Event Taxonomy: `packages/core/src/events/types.ts`

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-20  
**Status**: Living Document
