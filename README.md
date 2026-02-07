# Holistic Health Platform

WellnessOS - Enterprise-grade health platform with comprehensive tooling and CI/CD gates.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Available Scripts

### Development

- `npm run dev` - Start the development server
- `npm run build` - Build the production application
- `npm run start` - Start the production server

### Code Quality

- `npm run lint` - Lint the codebase with ESLint
- `npm run format` - Format the codebase with Prettier
- `npm run format:check` - Check if code is formatted correctly
- `npm run typecheck` - Type check the codebase with TypeScript

### Testing

- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml          # CI/CD pipeline
├── src/
│   ├── app/                # Next.js app directory
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home page
│   │   └── globals.css     # Global styles
│   ├── utils/              # Utility functions
│   └── __tests__/          # Test files
├── .eslintrc.json          # ESLint configuration
├── .prettierrc.json        # Prettier configuration
├── tsconfig.json           # TypeScript configuration (strict mode enabled)
├── vitest.config.ts        # Vitest configuration
├── next.config.mjs         # Next.js configuration
└── package.json            # Project dependencies and scripts
```

## Tooling & Standards

### TypeScript

The project uses TypeScript with **strict mode** enabled to ensure type safety throughout the codebase.

### ESLint

ESLint is configured with:

- Next.js recommended rules
- TypeScript ESLint plugin
- Prettier integration

### Prettier

Code formatting is enforced with Prettier to maintain consistent code style.

### Vitest

Unit testing is powered by Vitest, providing a fast and modern testing experience for Next.js applications.

## CI/CD

The project includes a GitHub Actions workflow that runs on every push and pull request:

1. **Linting** - Ensures code follows style guidelines
2. **Formatting Check** - Verifies code is properly formatted
3. **Type Checking** - Validates TypeScript types
4. **Testing** - Runs all unit tests
5. **Building** - Ensures the application builds successfully

All gates must pass before code can be merged.

## License

This project is private and proprietary.
