import { RequestContext } from "@/types/context";

export class Logger {
  static info(context: RequestContext, message: string, meta?: unknown): void {
    console.log(JSON.stringify({
      level: "info",
      requestId: context.requestId,
      tenantId: context.tenantId,
      userId: context.userId,
      timestamp: context.timestamp.toISOString(),
      message,
      meta,
    }));
  }

  static error(context: RequestContext, message: string, error?: unknown): void {
    console.error(JSON.stringify({
      level: "error",
      requestId: context.requestId,
      tenantId: context.tenantId,
      userId: context.userId,
      timestamp: context.timestamp.toISOString(),
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    }));
  }

  static warn(context: RequestContext, message: string, meta?: unknown): void {
    console.warn(JSON.stringify({
      level: "warn",
      requestId: context.requestId,
      tenantId: context.tenantId,
      userId: context.userId,
      timestamp: context.timestamp.toISOString(),
      message,
      meta,
    }));
  }

  static debug(context: RequestContext, message: string, meta?: unknown): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(JSON.stringify({
        level: "debug",
        requestId: context.requestId,
        tenantId: context.tenantId,
        userId: context.userId,
        timestamp: context.timestamp.toISOString(),
        message,
        meta,
      }));
    }
  }
}
