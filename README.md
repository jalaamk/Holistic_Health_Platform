# WellnessOS - Holistic Health Platform

Enterprise-grade holistic health and wellness platform built with operating-system architecture principles.

## 🎯 Vision

WellnessOS is a comprehensive health platform that merges clean architecture with enterprise-ready infrastructure:

- **OS-First Design**: Composable modules with strict contracts and event-driven communication
- **Privacy-First**: Consent gates, data classification, and audit logging by default
- **AI-Governed**: Prompt registry, explainability, and cost management built-in
- **Enterprise-Ready**: Multi-tenancy, SSO/SCIM ready, portable provider architecture

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - Complete system design and implementation status
- [Environment Setup](.env.example) - Required configuration variables

## 🏗️ Current Status

**Phase 0: Foundation & Gates** ✅ (In Progress)

- ✅ Next.js 16 + TypeScript setup
- ✅ Provider abstraction layer (Firebase, OpenAI)
- ✅ Standard API handler with auth/validation
- ✅ Entitlements service (feature gating)
- ✅ Core types and interfaces
- ✅ CI pipeline
- 🔄 Event Bus (next)
- 🔄 Profile Spine OS (next)

## 🔑 Key Features

### Provider Portability
Ship fast with Firebase + OpenAI, migrate to enterprise providers without rewrites:
- `IdentityProvider` → WorkOS/Auth0/Okta
- `DataStore` → Postgres/MongoDB/DynamoDB
- `AIProvider` → Azure/Bedrock/Vertex

### Multi-Tenancy
Built-in from day 1 with tenant-scoped entitlements and plan-based feature gating.

### BFF Pattern
One API call per screen returns complete ViewModels - no client-side orchestration.

### Event-Driven
Domains publish events, projections consume them. No cross-module database queries.

## 📦 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Auth**: Firebase Auth (behind IdentityProvider interface)
- **Database**: Firestore (behind DataStore interface)
- **AI**: OpenAI (behind AIProvider interface)
- **Validation**: Zod

## 🧪 Development

```bash
# Lint code
npm run lint

# Type check
npm run typecheck

# Build for production
npm run build

# Run tests
npm test
```

## 🏛️ Architecture Principles

1. **Single Source of Truth**: Profile Spine is canonical
2. **Module Ownership**: Each domain owns its data
3. **Compose via Contracts**: APIs + Events, not DB queries
4. **Consent Gates**: All tracking requires explicit consent
5. **Explainability**: AI outputs include reason codes

## 📖 License

ISC