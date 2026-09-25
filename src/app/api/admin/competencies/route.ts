import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { competencySchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";

export const GET = withApi(async () => {
  await requireSession();
  const competencies = await db.competency.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { questionMappings: true, courseWeights: true } } },
  });
  return NextResponse.json({ competencies });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = competencySchema.parse(await parseJson(req));

  const clash = await db.competency.findFirst({ where: { code: body.code.toUpperCase() } });
  if (clash) throw new HttpError(409, "A competency with that code already exists");

  const competency = await db.competency.create({
    data: {
      code: body.code.toUpperCase(),
      name: body.name,
      description: body.description ?? null,
      active: body.active,
    },
  });

  await logAudit({
    userId: session.id,
    action: "COMPETENCY_CREATED",
    entity: "Competency",
    entityId: competency.id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ competency }, { status: 201 });
});
