import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";
import { versionSchema } from "@/lib/validation";

export const GET = withApi(async () => {
  await requireSession();
  const versions = await db.assessmentVersion.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sections: { include: { _count: { select: { questions: true } } } },
      assessments: true,
      _count: { select: { attempts: true } },
    },
  });
  return NextResponse.json({ versions });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = versionSchema.parse(await parseJson(req));

  const clash = await db.assessmentVersion.findFirst({
    where: { versionNumber: body.versionNumber },
  });
  if (clash) throw new HttpError(409, "A version with that number already exists");

  const version = await db.assessmentVersion.create({
    data: {
      versionName: body.versionName,
      versionNumber: body.versionNumber,
      notes: body.notes ?? null,
      status: VERSION_STATUS.DRAFT,
    },
  });

  await logAudit({
    userId: session.id,
    action: "VERSION_CREATED",
    entity: "AssessmentVersion",
    entityId: version.id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ version }, { status: 201 });
});
