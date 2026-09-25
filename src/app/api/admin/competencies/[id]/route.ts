import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { z } from "zod";
import { ROLES } from "@/lib/constants";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  active: z.boolean().optional(),
});

export const PATCH = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;
  const existing = await db.competency.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Competency not found");

  const body = patchSchema.parse(await parseJson(req));
  const competency = await db.competency.update({ where: { id }, data: body });

  await logAudit({
    userId: session.id,
    action: "COMPETENCY_UPDATED",
    entity: "Competency",
    entityId: id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ competency });
});
