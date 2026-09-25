import { NextRequest, NextResponse } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";

/** Publish a draft version. Published content becomes immutable. */
export const POST = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;

  const version = await db.assessmentVersion.findUnique({
    where: { id },
    include: { sections: { include: { questions: true } } },
  });
  if (!version) throw new HttpError(404, "Version not found");
  if (version.status === VERSION_STATUS.PUBLISHED) {
    return NextResponse.json({ ok: true, alreadyPublished: true });
  }

  const questionCount = version.sections.reduce((n, s) => n + s.questions.length, 0);
  const emptySections = version.sections.filter((s) => s.questions.length === 0);
  if (questionCount === 0) throw new HttpError(400, "Add at least one question before publishing");
  if (version.sections.length === 0) throw new HttpError(400, "Add at least one section first");
  if (emptySections.length > 0) {
    throw new HttpError(400, `Sections without questions: ${emptySections.map((s) => s.code).join(", ")}`);
  }

  await db.assessmentVersion.update({
    where: { id },
    data: { status: VERSION_STATUS.PUBLISHED, publishedAt: new Date() },
  });

  await logAudit({
    userId: session.id,
    action: "VERSION_PUBLISHED",
    entity: "AssessmentVersion",
    entityId: id,
    meta: { versionNumber: version.versionNumber, questionCount },
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true, questionCount });
});
