# WellnessOS Architecture Blueprint v3

## Overview

This repository implements the **WellnessOS Enterprise Architecture** - a holistic health platform built with operating-system principles: composable modules, strict contracts, event-driven architecture, and governed AI.

## Prime Directive

### Non-negotiable Rules

1. **Single Source of Truth**: Profile Spine is canonical for identity/intent/preferences/constraints/consent
2. **Module Ownership**: Each domain owns its logs/time-series; modules read spine via snapshots
3. **Compose via Contracts + Events**: No cross-module DB queries; composition via APIs + event bus
4. **Consent Gates Everywhere**: Tracking + AI actions only within explicit consent scopes
5. **Explainability by Default**: Computed scores and AI recommendations include reason codes + confidence

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│         Clients (Web + Mobile)                  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│   BFF / API Gateway                             │
│   - Screen ViewModels                           │
│   - Auth + Entitlements + Policy Gate           │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│   Core OS                                       │
│   - Identity & Access                           │
│   - Policy & Consent                            │
│   - Profile Spine                               │
│   - Event Bus                                   │
│   - Plan, Timeline, Notification, Rewards       │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│   Domain OS                                     │
│   - Nutrition, Movement, Sleep                  │
│   - Habits, Mind/Journal                        │
│   - Social/Community                            │
└─────────────────────────────────────────────────┘
```

## Current Implementation Status

### Phase 0: Foundation & Gates (In Progress)

✅ **Completed**:
- Next.js 16 + TypeScript project structure
- Environment validation with Zod
- Provider interfaces (IdentityProvider, DataStore, AIProvider)
- Firebase adapters (Auth, Firestore)
- OpenAI provider adapter
- Standard API handler with auth/validation/rate limiting
- Entitlements service (feature gating + quotas)
- Core types and interfaces
- BFF endpoint example (Today screen)
- CI pipeline (lint, typecheck, build)

🔄 **In Progress**:
- Contract validation (OpenAPI/AsyncAPI)
- Event Bus implementation
- Profile Spine OS

⏳ **Planned**:
- Policy & Consent OS
- Full BFF screen contracts
- Observability foundations

### Phase 1: Tier A Backbone (Planned)
- Identity OS
- Policy & Consent OS
- Profile Spine OS
- Event Bus + Taxonomy
- Core screens (Today, Habits, Nutrition)

### Phase 2-4: See full blueprint

## Directory Structure

```
.
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── bff/          # Backend for Frontend
│   │       └── screens/  # Screen ViewModels
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── packages/              # Shared packages (monorepo pattern)
│   ├── config/           # Environment & configuration
│   ├── core/             # Core services (entitlements, api-handler)
│   ├── providers/        # Provider interfaces & adapters
│   └── types/            # Shared TypeScript types
├── docs/                  # Documentation
└── .github/
    └── workflows/        # CI/CD pipelines
```

## Provider Abstraction Strategy

We ship fast with Firebase + OpenAI but behind strict interfaces:

| Concern | Interface | Current | Enterprise Path |
|---------|-----------|---------|-----------------|
| Identity | `IdentityProvider` | Firebase Auth | WorkOS/Auth0/Okta |
| Data | `DataStore` | Firestore | Postgres/MongoDB |
| AI | `AIProvider` | OpenAI | Azure/Bedrock/Vertex |

This enables migration without architectural rewrites.

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn

### Setup

1. **Clone and install**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase and OpenAI credentials
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Access the app**:
   Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Type check with TypeScript
- `npm test` - Run tests

## Core Principles

### 1. Contract-First Development

All APIs defined with OpenAPI/AsyncAPI before implementation:
- Generate types from contracts
- Enforce contract tests in CI
- Breaking changes are blocked

### 2. Event-Driven Architecture

Events flow through a central bus with:
- Envelope schema with classification + consent scope
- Idempotency (eventId as key)
- Replay capability for projections
- Dead-letter queue for poison events

### 3. Multi-Tenancy

Built-in from day 1:
- `tenantId` in all requests/events/logs
- Tenant-scoped entitlements
- Plan-based feature gating

### 4. Observability

Structured logging with required fields:
- `requestId`, `traceId`, `tenantId`, `userId`
- `latencyMs`, `status`, `errorCode`
- AI: `promptId`, `tokensIn/Out`, `costEstimate`

### 5. Security & Privacy

- Data classification (public/internal/sensitive/phi)
- Consent-gated operations
- Audit logging (append-only)
- Field-level encryption (for PHI)

## API Examples

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Today Screen (requires auth)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/bff/screens/today
```

## Contributing

See full blueprint in the problem statement for:
- Epic breakdown
- Definition of Done criteria
- Phase-by-phase implementation plan

## License

ISC
