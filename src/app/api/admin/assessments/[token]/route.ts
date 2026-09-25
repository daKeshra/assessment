import { NextRequest, NextResponse } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";

/** Pause / resume / close a public assessment link. */
export const PATCH = withApi<{ token: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { token } = await params;
  const assessment = await db.assessment.findUnique({ where: { token } });
  if (!assessment) throw new HttpError(404, "Link not found");

  const status = await req.json().then((b) => (b as { status?: string }).status);
  if (!["ACTIVE", "PAUSED", "CLOSED"].includes(status ?? "")) {
    throw new HttpError(400, "Invalid status");
  }

  const updated = await db.assessment.update({ where: { token }, data: { status } });

  await logAudit({
    userId: session.id,
    action: "ASSESSMENT_LINK_UPDATED",
    entity: "Assessment",
    entityId: assessment.id,
    meta: { status },
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ assessment: updated });
});
