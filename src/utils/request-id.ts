import { nanoid } from "nanoid";

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${nanoid(16)}`;
}
