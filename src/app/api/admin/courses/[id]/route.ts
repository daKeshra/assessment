import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { courseSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";

export const PATCH = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;
  const course = await db.course.findUnique({ where: { id } });
  if (!course) throw new HttpError(404, "Course not found");

  const body = courseSchema.partial().parse(await parseJson(req));

  const updated = await db.course.update({
    where: { id },
    data: {
      courseName: body.courseName,
      description: body.description,
      careerFamily: body.careerFamily,
      ctaUrl: body.ctaUrl,
      progressionJson: body.progression ? JSON.stringify(body.progression) : undefined,
      minimumScore: body.minimumScore,
      active: body.active,
      displayOrder: body.displayOrder,
    },
  });

  await logAudit({
    userId: session.id,
    action: "COURSE_UPDATED",
    entity: "Course",
    entityId: id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ course: updated });
});
