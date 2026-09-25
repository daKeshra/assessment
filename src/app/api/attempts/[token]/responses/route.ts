import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import {
  loadAttempt,
  overallRemainingSeconds,
  sectionRemainingSeconds,
  sectionStartsOf,
} from "@/lib/attempt";
import { ATTEMPT_STATUS } from "@/lib/constants";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getAllSettings } from "@/lib/settings";
import { responseSchema } from "@/lib/validation";

/**
 * Autosave a single response (PRD §41: autosave within 1s, resume supported).
 * Records navigation position, per-question time and section-timer starts.
 */
export const POST = withApi<{ token: string }>(async (req: NextRequest, { params }) => {
  const { token } = await params;
  const body = responseSchema.parse(await parseJson(req));

  const attempt = await loadAttempt(token);
  if (!attempt) throw new HttpError(404, "Assessment attempt not found");
  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
    throw new HttpError(409, "This assessment has already been submitted", {
      code: "ALREADY_SUBMITTED",
      reportUrl: `/report/${attempt.token}`,
    });
  }

  const limit = rateLimit(`save:${attempt.id}`, { limit: 300, windowMs: 60_000 });
  if (!limit.ok) throw new HttpError(429, "Saving too quickly, slow down");

  const settings = await getAllSettings();
  const sectionCount = attempt.version.sections.length;

  // Overall timer check (PRD §26: expiry auto-submits on the client)
  const overall = overallRemainingSeconds(settings, attempt.startTime);
  if (overall !== null && overall <= 0) {
    throw new HttpError(409, "Time has expired", { code: "TIME_EXPIRED" });
  }

  // Record section start (SECTION timer mode) on first view of the section
  let sectionStarts = sectionStartsOf(attempt);
  let startedSectionNow = false;
  if (body.sectionId && !(body.sectionId in sectionStarts)) {
    sectionStarts = { ...sectionStarts, [body.sectionId]: Date.now() };
    startedSectionNow = true;
    await db.attempt.update({
      where: { id: attempt.id },
      data: { sectionStartsJson: JSON.stringify(sectionStarts) },
    });
  }

  // Per-section timer check
  if (body.sectionId && !startedSectionNow) {
    const sectionLeft = sectionRemainingSeconds(
      { ...attempt, sectionStartsJson: JSON.stringify(sectionStarts) },
      body.sectionId,
      settings,
      sectionCount,
    );
    if (sectionLeft !== null && sectionLeft <= 0) {
      throw new HttpError(409, "This section's time has expired", { code: "SECTION_EXPIRED" });
    }
  }

  const question = await db.question.findUnique({
    where: { id: body.questionId },
    select: { id: true, sectionId: true, active: true },
  });
  if (!question || !question.active) throw new HttpError(400, "Unknown question");

  await db.response.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: body.questionId } },
    update: {
      selectedOptionIds: JSON.stringify(body.selectedOptionIds),
      textResponse: body.textResponse ?? null,
      timeSpentMs: { increment: body.timeSpentMs },
    },
    create: {
      attemptId: attempt.id,
      questionId: body.questionId,
      selectedOptionIds: JSON.stringify(body.selectedOptionIds),
      textResponse: body.textResponse ?? null,
      timeSpentMs: body.timeSpentMs,
    },
  });

  await db.attempt.update({
    where: { id: attempt.id },
    data: {
      lastActivityAt: new Date(),
      currentQuestionId: body.currentQuestionId ?? body.questionId,
      ipAddress: clientIp(req),
    },
  });

  return NextResponse.json({
    saved: true,
    serverNow: new Date().toISOString(),
    remainingSeconds: overallRemainingSeconds(settings, attempt.startTime),
    sectionStarts,
  });
});
