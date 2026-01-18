# Holistic Health Platform

Enterprise-grade Next.js 15 (App Router) starter with TypeScript strict mode, comprehensive CI gates, and production-ready architecture.

## Features

✅ **Next.js 15 with App Router** - Modern React framework with file-based routing  
✅ **TypeScript (Strict Mode)** - Full type safety with strict compiler options  
✅ **Typed Environment Variables** - Zod validation for env vars  
✅ **Standard API Handler** - Request ID logging, Zod validation, stable error handling  
✅ **Tenant ID Context** - Multi-tenant architecture with tenant ID in all requests  
✅ **Firebase Auth + Firestore** - Behind clean interfaces for easy swapping  
✅ **Repository Layer** - No direct database access from UI components  
✅ **EntitlementsService** - Quota management and rate limiting  
✅ **BFF Pattern** - Backend-for-Frontend with typed ViewModels  
✅ **CI/CD Pipeline** - Automated linting, type checking, and builds  
✅ **Tailwind CSS** - Utility-first CSS framework

## Architecture

### Layers

1. **UI Layer** (`src/app/*`) - Next.js App Router pages and layouts
2. **BFF Layer** (`src/app/api/bff/*`) - Backend-for-Frontend API endpoints
3. **Service Layer** (`src/services/*`) - Business logic (e.g., EntitlementsService)
4. **Repository Layer** (`src/repositories/*`) - Data access abstraction
5. **Infrastructure Layer** (`src/lib/*`, `src/interfaces/*`) - Firebase implementations

### Key Components

- **Request Context**: Every API call includes `requestId`, `tenantId`, `userId`, and `timestamp`
- **Typed ViewModels**: Zod schemas ensure type safety between frontend and backend
- **Interface-based Design**: Easy to swap Firebase for other providers
- **Quota System**: Track and enforce resource usage limits per tenant

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Update .env.local with your Firebase credentials
```

### Environment Variables

Required environment variables (see `.env.example`):

```env
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin (Server)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Build

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/bff/today/       # BFF API endpoint
│   ├── today/               # Today page
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   └── globals.css          # Global styles
├── config/                   # Configuration
│   └── env.ts               # Typed environment variables
├── interfaces/               # Abstract interfaces
│   ├── auth.interface.ts    # Auth service interface
│   └── database.interface.ts # Database interface
├── lib/                      # Infrastructure implementations
│   ├── firebase-admin.ts    # Firebase Admin setup
│   ├── firebase-auth.service.ts # Firebase Auth implementation
│   └── firestore-database.service.ts # Firestore implementation
├── repositories/             # Data access layer
│   ├── user.repository.ts   # User data access
│   └── quota.repository.ts  # Quota data access
├── services/                 # Business logic
│   └── entitlements.service.ts # Quota enforcement
├── types/                    # Type definitions
│   ├── context.ts           # Request context
│   ├── errors.ts            # Error classes
│   └── view-models.ts       # API ViewModels
└── utils/                    # Utilities
    ├── api-handler.ts       # Standard API handler
    ├── logger.ts            # Structured logging
    └── request-id.ts        # Request ID generation
```

## API Documentation

### GET /api/bff/today

Returns the TodayViewModel with current stats and quota information.

**Query Parameters:**
- `tenantId` (required): Tenant identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-01-18T18:00:00.000Z",
    "greeting": "Good afternoon",
    "tenantId": "demo-tenant",
    "userId": "optional-user-id",
    "quotaStatus": {
      "resourceType": "api_calls",
      "used": 1,
      "limit": 1000,
      "remaining": 999
    },
    "stats": {
      "totalRequests": 1,
      "activeUsers": 1
    }
  },
  "requestId": "req_abc123"
}
```

## CI/CD

The project includes a GitHub Actions workflow that runs on every push:

1. **Lint Check** - ESLint validation
2. **Type Check** - TypeScript compilation
3. **Build Check** - Next.js production build
4. **Test Check** - Test suite execution

## Testing

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all CI checks pass
5. Submit a pull request

## License

ISC