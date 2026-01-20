/**
 * Profile Spine API
 * GET /api/spine/[userId] - Get spine snapshot
 * PATCH /api/spine/[userId] - Apply patches with optimistic concurrency
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/packages/core/api-handler';
import { getSpineService, type SpinePatchOperation } from '@/packages/core/profile-spine';

// Patch operation schema
const PatchOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace', 'test']),
  path: z.string(),
  value: z.unknown().optional(),
});

// Patch request schema
const PatchRequestSchema = z.object({
  version: z.number().int().positive(),
  operations: z.array(PatchOperationSchema),
  reason: z.string().optional(),
});

// Export route handlers with parameter extraction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  
  const handler = createApiHandler({
    auth: true,
    handler: async (_input, context) => {
      const spineService = getSpineService();
      
      // Authorization: user can only access their own spine
      if (context.userId !== userId && !context.roles.includes('admin')) {
        throw new Error('Unauthorized to access this spine');
      }

      const spine = await spineService.getSnapshot(userId, context.tenantId);
      
      if (!spine) {
        throw new Error('Spine not found');
      }

      return spine;
    },
  });
  
  return handler(request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  
  const handler = createApiHandler({
    auth: true,
    validation: PatchRequestSchema,
    handler: async (input, context) => {
      const spineService = getSpineService();
      
      // Authorization: user can only patch their own spine
      if (context.userId !== userId && !context.roles.includes('admin')) {
        throw new Error('Unauthorized to patch this spine');
      }

      const result = await spineService.applyPatch({
        userId: userId,
        tenantId: context.tenantId,
        version: input.version,
        operations: input.operations as SpinePatchOperation[],
        reason: input.reason,
      });

      if (!result.success) {
        const status = result.error?.code === 'VERSION_CONFLICT' ? 409 : 400;
        return NextResponse.json(
          { success: false, error: result.error },
          { status }
        );
      }

      return result.spine;
    },
  });
  
  return handler(request);
}
