import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, withApi } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const eventSchema = z.object({
  attemptToken: z.string().min(10).max(200),
  courseCode: z.string().trim().min(2).max(80),
  eventType: z.enum(["CTA_CLICKED", "RECOMMENDATION_ACCEPTED"]),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/** Privacy-conscious CTA/acceptance events used by staff analytics. */
export const POST = withApi(async (req: NextRequest) => {
  const ip = clientIp(req);
  const limit = rateLimit(`analytics-event:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) throw new HttpError(429, "Too many analytics events; try again shortly");

  const body = eventSchema.parse(await req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body");
  }));

  const [attempt, course] = await Promise.all([
    db.attempt.findUnique({
      where: { token: body.attemptToken },
      select: { id: true, status: true },
    }),
    db.course.findUnique({
      where: { courseCode: body.courseCode },
      select: { id: true, active: true },
    }),
  ]);
  if (!attempt || !["SUBMITTED", "TIMED_OUT"].includes(attempt.status)) {
    throw new HttpError(404, "Completed assessment not found");
  }
  if (!course || !course.active) throw new HttpError(404, "Course not found");
  const isCourseInAttempt = await db.courseScore.findFirst({
    where: { attemptId: attempt.id, courseId: course.id },
    select: { id: true },
  });
  if (!isCourseInAttempt) {
    throw new HttpError(400, "That course is not part of this assessment result");
  }

  const event = await db.assessmentEvent.create({
    data: {
      type: body.eventType,
      attemptId: attempt.id,
      courseId: course.id,
      metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  });

  return NextResponse.json({ ok: true, eventId: event.id }, { status: 201 });
});
