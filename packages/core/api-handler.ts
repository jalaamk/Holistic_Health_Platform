/**
 * Standard API Handler
 * Phase 0: Enforces consistent request handling
 * 
 * All API routes must use this handler to ensure:
 * - Authentication
 * - Validation (Zod schemas)
 * - Rate limiting
 * - Logging with structured fields
 * - Error handling
 * - Request context propagation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, type ZodSchema } from 'zod';
import type { RequestContext, ApiResponse } from '@/packages/types';
import { getIdentityProvider } from '@/packages/providers/firebase-identity';
import { randomUUID } from 'crypto';

export interface ApiHandlerOptions<TInput = unknown, TOutput = unknown> {
  auth?: boolean; // Require authentication (default: true)
  validation?: ZodSchema<TInput>; // Input validation schema
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  handler: (
    input: TInput,
    context: RequestContext
  ) => Promise<TOutput>;
}

/**
 * Create a standard API route handler
 */
export function createApiHandler<TInput = unknown, TOutput = unknown>(
  options: ApiHandlerOptions<TInput, TOutput>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = randomUUID();
    const traceId = request.headers.get('x-trace-id') || randomUUID();
    const startTime = Date.now();

    try {
      // 1. Authentication
      const context = await authenticateRequest(request, requestId, traceId, options.auth);

      // 2. Rate limiting (if configured)
      if (options.rateLimit) {
        await checkRateLimit(context.tenantId, options.rateLimit);
      }

      // 3. Parse and validate input
      let input: TInput;
      if (request.method === 'GET') {
        const searchParams = request.nextUrl.searchParams;
        const queryParams: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });
        input = queryParams as TInput;
      } else {
        const body = await request.json();
        input = body as TInput;
      }

      if (options.validation) {
        input = options.validation.parse(input);
      }

      // 4. Execute handler
      const result = await options.handler(input, context);

      // 5. Log success
      const latencyMs = Date.now() - startTime;
      logRequest({
        requestId,
        traceId,
        userId: context.userId,
        tenantId: context.tenantId,
        route: request.nextUrl.pathname,
        method: request.method,
        status: 200,
        latencyMs,
      });

      // 6. Return response
      const response: ApiResponse<TOutput> = {
        success: true,
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      return handleError(error, requestId, traceId, request, startTime);
    }
  };
}

/**
 * Authenticate request and build context
 */
async function authenticateRequest(
  request: NextRequest,
  requestId: string,
  traceId: string,
  requireAuth: boolean = true
): Promise<RequestContext> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader && requireAuth) {
    throw new AuthenticationError('Missing authorization header');
  }

  if (!authHeader) {
    // Anonymous context
    return {
      requestId,
      traceId,
      userId: 'anonymous',
      tenantId: 'public',
      roles: [],
      entitlements: [],
      timestamp: new Date(),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const identityProvider = getIdentityProvider();
  
  try {
    const claims = await identityProvider.verifyToken(token);
    
    return {
      requestId,
      traceId,
      userId: claims.userId,
      tenantId: claims.tenantId || 'default',
      deviceId: request.headers.get('x-device-id') || undefined,
      roles: claims.roles || [],
      entitlements: [], // TODO: Load from entitlements service
      timestamp: new Date(),
    };
  } catch {
    throw new AuthenticationError('Invalid token');
  }
}

/**
 * Check rate limit (simple in-memory implementation)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(
  tenantId: string,
  config: { maxRequests: number; windowMs: number }
): Promise<void> {
  const now = Date.now();
  const key = tenantId;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return;
  }

  if (record.count >= config.maxRequests) {
    throw new RateLimitError('Rate limit exceeded');
  }

  record.count++;
}

/**
 * Structured logging
 */
function logRequest(data: {
  requestId: string;
  traceId: string;
  userId: string;
  tenantId: string;
  route: string;
  method: string;
  status: number;
  latencyMs: number;
}): void {
  console.log(JSON.stringify({
    event: 'api.request',
    ...data,
  }));
}

/**
 * Error handling
 */
function handleError(
  error: unknown,
  requestId: string,
  traceId: string,
  request: NextRequest,
  startTime: number
): NextResponse {
  const latencyMs = Date.now() - startTime;

  // Determine error type and status
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  if (error instanceof AuthenticationError) {
    status = 401;
    code = 'AUTHENTICATION_FAILED';
    message = error.message;
  } else if (error instanceof AuthorizationError) {
    status = 403;
    code = 'AUTHORIZATION_FAILED';
    message = error.message;
  } else if (error instanceof ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error instanceof RateLimitError) {
    status = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    message = error.message;
  } else if (error instanceof z.ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid input';
  }

  // Log error
  console.error(JSON.stringify({
    event: 'api.error',
    requestId,
    traceId,
    route: request.nextUrl.pathname,
    method: request.method,
    status,
    code,
    message,
    latencyMs,
    error: error instanceof Error ? error.message : String(error),
  }));

  // Return error response
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details: error instanceof z.ZodError ? error.issues : undefined,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status });
}

/**
 * Error classes
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
