import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buildAttemptOrders } from "@/lib/randomize";
import { getAllSettings, boolOf } from "@/lib/settings";
import { SETTING_KEYS, VERSION_STATUS } from "@/lib/constants";
import { registerSchema } from "@/lib/validation";

/**
 * Register a candidate and start (or resume) an assessment.
 * Re-submitting with the same email on the same assessment resumes the
 * existing attempt instead of creating a duplicate (PRD §50).
 */
export const POST = withApi<{ token: string }>(async (req: NextRequest, { params }) => {
  const ip = clientIp(req);
  const limit = rateLimit(`start:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!limit.ok) throw new HttpError(429, "Too many attempts. Please wait a moment.");

  const { token } = await params;
  const body = registerSchema.parse(await parseJson(req));

  const assessment = await db.assessment.findUnique({
    where: { token },
    include: {
      version: {
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: {
              questions: {
                orderBy: { position: "asc" },
                include: { options: true },
              },
            },
          },
        },
      },
    },
  });

  if (!assessment || assessment.status !== "ACTIVE") {
    throw new HttpError(404, "This assessment link is not active.");
  }
  if (assessment.version.status !== VERSION_STATUS.PUBLISHED) {
    throw new HttpError(404, "This assessment version is not published.");
  }

  const existingCandidate = await db.candidate.findFirst({ where: { email: body.email } });
  const candidate = existingCandidate
    ? await db.candidate.update({
        where: { id: existingCandidate.id },
        data: {
          fullName: body.fullName,
          phone: body.phone,
          educationLevel: body.educationLevel,
          occupation: body.occupation,
          ageRange: body.ageRange || null,
          techExposure: body.techExposure || null,
          hoursPerWeek: body.hoursPerWeek || null,
          preferredFormat: body.preferredFormat || null,
        },
      })
    : await db.candidate.create({
        data: {
          email: body.email,
          fullName: body.fullName,
          phone: body.phone,
          educationLevel: body.educationLevel,
          occupation: body.occupation,
          ageRange: body.ageRange || null,
          techExposure: body.techExposure || null,
          hoursPerWeek: body.hoursPerWeek || null,
          preferredFormat: body.preferredFormat || null,
        },
      });

  const existing = await db.attempt.findUnique({
    where: { candidateId_assessmentId: { candidateId: candidate.id, assessmentId: assessment.id } },
  });
  if (existing) {
    return NextResponse.json({ attemptToken: existing.token, resumed: true, status: existing.status });
  }

  const settings = await getAllSettings();
  const attemptToken = crypto.randomBytes(18).toString("base64url");

  const orders = buildAttemptOrders({
    attemptToken,
    sections: assessment.version.sections.map((s) => ({
      id: s.id,
      questions: s.questions.map((q) => ({
        id: q.id,
        type: q.type,
        options: q.options.map((o) => ({ id: o.id })),
        items: q.itemsJson
          ? (JSON.parse(q.itemsJson) as { id: string }[]).map((i) => ({ id: i.id }))
          : null,
      })),
    })),
    randomizeQuestions: boolOf(settings, SETTING_KEYS.RANDOMIZE_QUESTIONS, true),
    randomizeOptions: boolOf(settings, SETTING_KEYS.RANDOMIZE_OPTIONS, true),
  });

  const attempt = await db.attempt.create({
    data: {
      token: attemptToken,
      candidateId: candidate.id,
      assessmentId: assessment.id,
      assessmentVersionId: assessment.version.id,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      questionOrderJson: JSON.stringify(orders.questionOrder),
      optionOrderJson: JSON.stringify(orders.optionOrder),
      itemOrderJson: JSON.stringify(orders.itemOrder),
    },
  });

  return NextResponse.json({ attemptToken: attempt.token, resumed: false, status: attempt.status });
});
