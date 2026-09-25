import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  weight: z.number().min(0).max(100).optional(),
  position: z.number().int().min(0).max(99).optional(),
  component: z.enum(["COGNITIVE", "SIMULATION", "BEHAVIOUR", "INTEREST", "MOTIVATION"]).optional(),
});

async function load(id: string) {
  const section = await db.section.findUnique({
    where: { id },
    include: { version: true, questions: true },
  });
  if (!section) throw new HttpError(404, "Section not found");
  if (section.version.status !== VERSION_STATUS.DRAFT) {
    throw new HttpError(409, "Published versions are immutable. Duplicate the version first.", {
      code: "VERSION_IMMUTABLE",
    });
  }
  return section;
}

export const PATCH = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;
  await load(id);
  const body = patchSchema.parse(await parseJson(req));

  const section = await db.section.update({ where: { id }, data: body });

  await logAudit({
    userId: session.id,
    action: "SECTION_UPDATED",
    entity: "Section",
    entityId: id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ section });
});

export const DELETE = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;
  const section = await load(id);
  if (section.questions.length > 0) {
    throw new HttpError(409, "Delete the section's questions first");
  }
  await db.section.delete({ where: { id } });

  await logAudit({
    userId: session.id,
    action: "SECTION_DELETED",
    entity: "Section",
    entityId: id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true });
});
