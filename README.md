# WellnessOS - Enterprise Holistic Health Platform

## Overview

WellnessOS is an enterprise-grade holistic health platform built with an OS-first architecture. It implements:

- **Profile Spine**: Canonical source of truth for user identity, preferences, and computed state
- **Event-Driven Architecture**: Domain events with strict contracts and idempotency
- **Provider Abstractions**: Portable interfaces for identity, data storage, and AI
- **BFF Pattern**: Screen-based ViewModels for optimal client experience
- **Enterprise Ready**: Multi-tenancy, entitlements, consent management, and audit logging

## Architecture Principles

1. **Single Source of Truth**: Profile Spine is canonical
2. **Module Ownership**: Each domain owns its data; no cross-module DB queries
3. **Compose via Contracts + Events**: APIs and event bus, not direct dependencies
4. **Consent Gates Everywhere**: Explicit consent for all tracking and AI actions
5. **Explainability by Default**: Computed scores include reason codes and evidence

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- Firebase configuration
- OpenAI API key
- Application URL

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Build

```bash
npm run build
```

### Testing

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run test:ci       # CI mode with coverage
```

### Code Quality

```bash
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
npm run validate      # Run all checks (typecheck + lint + test + build)
```

## Project Structure

```
.
├── packages/core/              # Core domain models and interfaces
│   └── src/
│       ├── models/            # Domain models and types
│       ├── providers/         # Provider interfaces (Identity, Data, AI)
│       ├── events/            # Event envelope and taxonomy
│       ├── services/          # Core services (Entitlements, etc.)
│       ├── config/            # Configuration and env validation
│       └── utils/             # Utilities (API handler, etc.)
│
├── src/
│   └── app/                   # Next.js App Router
│       ├── api/bff/           # Backend-for-Frontend endpoints
│       └── ...
│
├── contracts/                 # API and Event contracts
│   ├── openapi/              # OpenAPI specifications
│   └── asyncapi/             # AsyncAPI event schemas
│
└── ...
```

## Key Components

### Provider Interfaces

Located in `packages/core/src/providers/`:

- **IdentityProvider**: Authentication and user management
- **DataStoreProvider**: Database abstraction
- **AIProvider**: AI inference and embeddings
- **SecretsVaultProvider**: Secrets management

These enable portability - start with Firebase/OpenAI, migrate to enterprise providers without rewrites.

### API Handler

All API routes use `createHandler()` from `packages/core/src/utils/handler.ts` which provides:

- Authentication and authorization
- Input validation with Zod
- Rate limiting
- Entitlement checking
- Quota enforcement
- Structured logging
- Error handling

### BFF Endpoints

Screen-based endpoints in `src/app/api/bff/screens/`:

- `/bff/screens/today` - Today screen ViewModel
- `/bff/screens/nutrition-dashboard` - Nutrition dashboard ViewModel
- `/bff/screens/habits` - Habits screen ViewModel

Each endpoint returns all data needed to render a screen in a single call.

### Event Bus

Event taxonomy and envelope defined in `packages/core/src/events/types.ts`.

All events follow a standard structure with:
- Event ID and type
- Tenant and user context
- Actor information
- Data classification
- Consent scope
- Trace ID for distributed tracing
- Event-specific payload

## Contracts

### OpenAPI

REST API contracts in `contracts/openapi/bff.yaml`.

### AsyncAPI

Event schemas in `contracts/asyncapi/events.yaml`.

## Development Workflow

1. **Define Contract**: Start with OpenAPI/AsyncAPI schema
2. **Generate Types**: TypeScript types from contracts
3. **Implement Handler**: Use `createHandler()` wrapper
4. **Add Tests**: Unit and integration tests
5. **Document**: Update this README and inline docs

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. Type checking
2. Linting
3. Tests with coverage
4. Build verification

All checks must pass before merge.

## Security

- Environment validation at startup
- Authentication required by default
- Entitlement checking for features
- Quota enforcement
- Audit logging for sensitive operations
- Data classification (public, internal, sensitive, PHI)

## License

Proprietary - All rights reserved

## Support

For issues and questions, contact the WellnessOS team.