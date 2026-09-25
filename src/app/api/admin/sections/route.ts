import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";
import { sectionSchema } from "@/lib/validation";

export const GET = withApi(async (req: NextRequest) => {
  await requireSession();
  const versionId = new URL(req.url).searchParams.get("versionId") ?? undefined;
  const sections = await db.section.findMany({
    where: { assessmentVersionId: versionId },
    orderBy: { position: "asc" },
    include: { _count: { select: { questions: true } } },
  });
  return NextResponse.json({ sections });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = sectionSchema.parse(await parseJson(req));

  const version = await db.assessmentVersion.findUnique({
    where: { id: body.assessmentVersionId },
  });
  if (!version) throw new HttpError(400, "Unknown assessment version");
  if (version.status !== VERSION_STATUS.DRAFT) {
    throw new HttpError(409, "Published versions are immutable. Duplicate the version first.", {
      code: "VERSION_IMMUTABLE",
    });
  }

  const section = await db.section.create({ data: { ...body } });

  await logAudit({
    userId: session.id,
    action: "SECTION_CREATED",
    entity: "Section",
    entityId: section.id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ section }, { status: 201 });
});
