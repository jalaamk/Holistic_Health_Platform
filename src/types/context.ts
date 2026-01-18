/**
 * Request context that flows through all API calls
 * Contains tenant information and request tracking
 */
export interface RequestContext {
  requestId: string;
  tenantId: string;
  userId?: string;
  timestamp: Date;
}
