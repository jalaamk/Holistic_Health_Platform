# Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   
   Copy the `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. **Set Up Firebase**
   
   To use this application, you need to set up a Firebase project:
   
   a. Go to [Firebase Console](https://console.firebase.google.com/)
   b. Create a new project or use an existing one
   c. Enable Authentication and Firestore
   d. Get your Firebase config from Project Settings
   e. Create a service account and download the JSON key
   f. Update `.env.local` with your Firebase credentials

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Firebase Configuration

### Client-Side Config (NEXT_PUBLIC_*)
These variables are exposed to the browser:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Server-Side Config (FIREBASE_ADMIN_*)
These are kept secret on the server:
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

**Note:** The private key should be a valid PEM-formatted private key from your Firebase service account JSON file.

## Testing Without Firebase

For CI/CD and testing purposes, the build process works with placeholder values. However, the runtime API calls will fail without valid Firebase credentials.

To run the application without Firebase:
1. You can modify the interfaces to use mock implementations
2. Or set up your own Firebase project (free tier available)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `npm test` - Run tests (currently placeholder)

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:
1. Lint check
2. Type check
3. Build check
4. Test check

All checks must pass before merging.
