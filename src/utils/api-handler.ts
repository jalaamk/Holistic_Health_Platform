import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";
import { RequestContext } from "@/types/context";
import { AppError, ValidationError, AuthenticationError } from "@/types/errors";
import { generateRequestId } from "./request-id";
import { Logger } from "./logger";
import { authService } from "@/lib/firebase-auth.service";

export interface ApiHandlerOptions<TBody = unknown, TResponse = unknown> {
  requestSchema?: ZodSchema<TBody>;
  responseSchema?: ZodSchema<TResponse>;
  requireAuth?: boolean;
}

export type ApiHandler<TBody = unknown, TResponse = unknown> = (
  request: NextRequest,
  context: RequestContext,
  body: TBody
) => Promise<TResponse>;

/**
 * Standard API handler with request ID, logging, validation, and error handling
 */
export function createApiHandler<TBody = unknown, TResponse = unknown>(
  handler: ApiHandler<TBody, TResponse>,
  options: ApiHandlerOptions<TBody, TResponse> = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();
    let tenantId = "default";
    let userId: string | undefined;

    // Create initial context for logging
    let context: RequestContext = {
      requestId,
      tenantId,
      userId,
      timestamp: new Date(),
    };

    try {
      Logger.info(context, `API Request: ${request.method} ${request.url}`);

      // Extract tenant ID from headers or query params
      const tenantIdFromHeader = request.headers.get("x-tenant-id");
      const tenantIdFromQuery = request.nextUrl.searchParams.get("tenantId");
      tenantId = tenantIdFromHeader || tenantIdFromQuery || "default";

      // Authentication check if required
      if (options.requireAuth !== false) {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          throw new AuthenticationError("Missing or invalid authorization header");
        }

        const token = authHeader.substring(7);
        const user = await authService.verifyToken(token);
        userId = user.uid;
        tenantId = user.tenantId || tenantId;
      }

      // Update context with auth info
      context = {
        requestId,
        tenantId,
        userId,
        timestamp: new Date(),
      };

      Logger.info(context, "Context established", { tenantId, userId });

      // Parse and validate request body
      let body: TBody = {} as TBody;
      if (request.method !== "GET" && request.method !== "DELETE") {
        const rawBody = await request.json().catch(() => ({}));
        
        if (options.requestSchema) {
          const validationResult = options.requestSchema.safeParse(rawBody);
          if (!validationResult.success) {
            throw new ValidationError(
              "Invalid request body",
              validationResult.error.flatten()
            );
          }
          body = validationResult.data;
        } else {
          body = rawBody;
        }
      }

      // Execute handler
      const result = await handler(request, context, body);

      // Validate response if schema provided
      if (options.responseSchema) {
        const validationResult = options.responseSchema.safeParse(result);
        if (!validationResult.success) {
          Logger.error(context, "Response validation failed", validationResult.error);
          throw new Error("Response validation failed");
        }
      }

      Logger.info(context, "API Request completed successfully");

      return NextResponse.json(
        {
          success: true,
          data: result,
          requestId,
        },
        {
          status: 200,
          headers: {
            "x-request-id": requestId,
            "x-tenant-id": tenantId,
          },
        }
      );
    } catch (error) {
      Logger.error(context, "API Request failed", error);

      if (error instanceof AppError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
            requestId,
          },
          {
            status: error.statusCode,
            headers: {
              "x-request-id": requestId,
              "x-tenant-id": tenantId,
            },
          }
        );
      }

      // Unknown error
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId,
        },
        {
          status: 500,
          headers: {
            "x-request-id": requestId,
            "x-tenant-id": tenantId,
          },
        }
      );
    }
  };
}
