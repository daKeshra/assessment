import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { courseCreateSchema } from "@/lib/validation";

export const GET = withApi(async () => {
  await requireSession();
  const courses = await db.course.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { competencyWeights: true } } },
  });
  return NextResponse.json({ courses });
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = courseCreateSchema.parse(await parseJson(req));
  const clash = await db.course.findUnique({ where: { courseCode: body.courseCode } });
  if (clash) throw new HttpError(409, "A course with that code already exists");

  const course = await db.course.create({
    data: {
      courseCode: body.courseCode,
      courseName: body.courseName,
      description: body.description ?? null,
      careerFamily: body.careerFamily ?? null,
      ctaUrl: body.ctaUrl ?? null,
      progressionJson: JSON.stringify(body.progression ?? []),
      minimumScore: body.minimumScore,
      active: body.active,
      displayOrder: body.displayOrder,
    },
  });

  await logAudit({
    userId: session.id,
    action: "COURSE_CREATED",
    entity: "Course",
    entityId: course.id,
    meta: { courseCode: course.courseCode },
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ course }, { status: 201 });
});
