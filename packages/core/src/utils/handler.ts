/**
 * Standard API Handler
 * Provides authentication, validation, logging, rate limiting, and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RequestContext, ApiResponse, ApiError } from '../models/types';
import { entitlementsService } from '../services/entitlements';

export interface HandlerOptions<TInput, TOutput> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  inputSchema?: ZodSchema<TInput>;
  requireAuth?: boolean;
  requireEntitlement?: string;
  requireQuota?: { name: string; amount?: number };
  rateLimit?: { windowMs: number; maxRequests: number };
  handler: (input: TInput, context: RequestContext) => Promise<TOutput>;
}

export function createHandler<TInput = void, TOutput = unknown>(
  options: HandlerOptions<TInput, TOutput>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = uuidv4();
    const traceId = request.headers.get('x-trace-id') || uuidv4();

    try {
      // 1. Method validation
      if (request.method !== options.method) {
        return createErrorResponse(
          {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${request.method} not allowed`,
            traceId,
          },
          405,
          requestId,
          startTime
        );
      }

      // 2. Authentication (if required)
      let context: RequestContext | null = null;
      if (options.requireAuth !== false) {
        context = await authenticateRequest(request, requestId, traceId);
        if (!context) {
          return createErrorResponse(
            {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
              traceId,
            },
            401,
            requestId,
            startTime
          );
        }
      } else {
        // Create minimal context for non-authenticated requests
        context = {
          requestId,
          traceId,
          tenantId: 'public',
          userId: 'anonymous',
          timestamp: new Date(),
          featureFlags: {},
          entitlements: entitlementsService.getEntitlementsForTier('consumer'),
        };
      }

      // 3. Entitlement check
      if (options.requireEntitlement) {
        entitlementsService.enforceFeature(context, options.requireEntitlement);
      }

      // 4. Quota check
      if (options.requireQuota) {
        entitlementsService.enforceQuota(
          context,
          options.requireQuota.name,
          options.requireQuota.amount
        );
      }

      // 5. Rate limiting (placeholder - would integrate with real rate limiter)
      if (options.rateLimit) {
        const rateLimitOk = await checkRateLimit(
          context.userId,
          options.rateLimit.windowMs,
          options.rateLimit.maxRequests
        );
        if (!rateLimitOk) {
          return createErrorResponse(
            {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              traceId,
            },
            429,
            requestId,
            startTime
          );
        }
      }

      // 6. Input validation
      let input: TInput;
      if (options.inputSchema) {
        const rawInput = await parseRequestBody(request);
        const validationResult = options.inputSchema.safeParse(rawInput);
        if (!validationResult.success) {
          return createErrorResponse(
            {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: validationResult.error.errors },
              traceId,
            },
            400,
            requestId,
            startTime
          );
        }
        input = validationResult.data;
      } else {
        input = undefined as TInput;
      }

      // 7. Execute handler
      const output = await options.handler(input, context);

      // 8. Success response
      const response: ApiResponse<TOutput> = {
        success: true,
        data: output,
        metadata: {
          requestId,
          timestamp: new Date(),
          latencyMs: Date.now() - startTime,
          version: '1.0.0',
        },
      };

      // 9. Structured logging
      logRequest(context, options.method, 200, Date.now() - startTime);

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      // Error handling
      console.error('Handler error:', error);

      const apiError: ApiError = {
        code: error instanceof Error && 'code' in error ? (error as { code: string }).code : 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error instanceof Error && 'details' in error ? (error as { details: Record<string, unknown> }).details : undefined,
        traceId,
      };

      const statusCode = getStatusCodeForError(apiError.code);

      return createErrorResponse(apiError, statusCode, requestId, startTime);
    }
  };
}

async function authenticateRequest(
  request: NextRequest,
  requestId: string,
  traceId: string
): Promise<RequestContext | null> {
  // Placeholder - would integrate with IdentityProvider
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // TODO: Verify token with IdentityProvider
  // For now, return mock context
  return {
    requestId,
    traceId,
    tenantId: 'tenant-123',
    userId: 'user-123',
    timestamp: new Date(),
    featureFlags: {},
    entitlements: entitlementsService.getEntitlementsForTier('consumer'),
  };
}

async function parseRequestBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return request.json();
  }
  return {};
}

async function checkRateLimit(
  _userId: string,
  _windowMs: number,
  _maxRequests: number
): Promise<boolean> {
  // Placeholder - would integrate with Redis or similar
  return true;
}

function createErrorResponse(
  error: ApiError,
  status: number,
  requestId: string,
  startTime: number
): NextResponse {
  const response: ApiResponse<never> = {
    success: false,
    error,
    metadata: {
      requestId,
      timestamp: new Date(),
      latencyMs: Date.now() - startTime,
      version: '1.0.0',
    },
  };

  return NextResponse.json(response, { status });
}

function getStatusCodeForError(code: string): number {
  const statusCodes: Record<string, number> = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    RATE_LIMIT_EXCEEDED: 429,
    FEATURE_NOT_ENABLED: 403,
    QUOTA_EXCEEDED: 429,
    INTERNAL_ERROR: 500,
  };

  return statusCodes[code] || 500;
}

function logRequest(
  context: RequestContext,
  method: string,
  status: number,
  latencyMs: number
): void {
  // Structured logging
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    requestId: context.requestId,
    traceId: context.traceId,
    tenantId: context.tenantId,
    userId: context.userId,
    method,
    status,
    latencyMs,
    timestamp: context.timestamp.toISOString(),
  }));
}
