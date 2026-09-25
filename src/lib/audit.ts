import { db } from "@/lib/db";

export async function logAudit(opts: {
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  meta?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        metaJson: opts.meta ? JSON.stringify(opts.meta) : null,
        ipAddress: opts.ip ?? null,
      },
    });
  } catch (err) {
    // Auditing must never break the main flow.
    console.error("[audit] failed to write log", err);
  }
}
