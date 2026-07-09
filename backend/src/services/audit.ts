import { prisma } from '../lib/prisma.js';

export async function audit(
  entityType: string,
  entityId: string | null,
  action: string,
  userId: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId,
        details: (details ?? {}) as any,
      },
    });
  } catch {
    // Audit failures should not break user requests.
  }
}
