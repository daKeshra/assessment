import { NextRequest, NextResponse } from "next/server";
import { parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";

export const GET = withApi(async () => {
  await requireSession();
  const courses = await db.course.findMany({
    orderBy: { displayOrder: "asc" },
    include: { competencyWeights: true },
  });
  return NextResponse.json({ courses });
});

/** Bulk save the course-competency weight matrix (0..5). */
export const PUT = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = (await parseJson(req)) as {
    weights?: Record<string, Record<string, number>>;
    courses?: Record<string, Record<string, unknown>>;
  };

  if (body.weights) {
    let updated = 0;
    for (const [courseId, perCompetency] of Object.entries(body.weights)) {
      for (const [competencyId, weight] of Object.entries(perCompetency)) {
        const w = Number(weight);
        if (!Number.isFinite(w) || w < 0 || w > 5) continue;
        await db.courseCompetencyWeight.upsert({
          where: { courseId_competencyId: { courseId, competencyId } },
          update: { weight: Math.round(w) },
          create: { courseId, competencyId, weight: Math.round(w) },
        });
        updated += 1;
      }
    }
    await logAudit({
      userId: session.id,
      action: "WEIGHTS_UPDATED",
      entity: "CourseCompetencyWeight",
      meta: { cells: updated },
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: true, updated });
  }

  return NextResponse.json({ ok: true });
});
