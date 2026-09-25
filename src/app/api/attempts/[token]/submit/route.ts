import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { allowedTotalSeconds, overallRemainingSeconds } from "@/lib/attempt";
import { ATTEMPT_STATUS, SETTING_KEYS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendCandidateSubmittedEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { scoreAndStoreAttempt } from "@/lib/pipeline";
import { getAllSettings, numOf } from "@/lib/settings";
import { submitSchema } from "@/lib/validation";

/**
 * Submit the assessment. Idempotent: a duplicate submit returns the existing
 * result instead of scoring twice (PRD §50 duplicate-submission rule).
 */
export const POST = withApi<{ token: string }>(async (req: NextRequest, { params }) => {
  const { token } = await params;
  const body = submitSchema.parse(await parseJson(req).catch(() => ({})));

  const attempt = await db.attempt.findUnique({
    where: { token },
    include: { candidate: true, version: { include: { sections: true } }, assessment: true },
  });
  if (!attempt) throw new HttpError(404, "Assessment attempt not found");

  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
    return NextResponse.json({
      alreadySubmitted: true,
      attemptToken: attempt.token,
      reportUrl: `/report/${attempt.token}`,
    });
  }

  const limit = rateLimit(`submit:${attempt.id}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) throw new HttpError(429, "Please wait before submitting again");

  const settings = await getAllSettings();
  const sectionCount = attempt.version.sections.length;
  const now = new Date();
  const overall = overallRemainingSeconds(settings, attempt.startTime, now);
  const expired = (overall !== null && overall <= 0) || body.timedOut;

  const durationSeconds = Math.max(
    0,
    Math.round((now.getTime() - attempt.startTime.getTime()) / 1000),
  );
  const allowed = allowedTotalSeconds(settings, sectionCount);
  const rapidPct = numOf(settings, SETTING_KEYS.RAPID_COMPLETION_PCT, 0.25);
  const inactivityMinutes = numOf(settings, SETTING_KEYS.INACTIVITY_MINUTES, 20);

  const inactivityMs = now.getTime() - attempt.lastActivityAt.getTime();
  const flags = {
    autoSubmitted: expired,
    rapidCompletion: allowed > 0 && durationSeconds < allowed * rapidPct,
    durationRatio: allowed > 0 ? Math.round((durationSeconds / allowed) * 100) / 100 : null,
    inactiveNearEnd: inactivityMs > inactivityMinutes * 60_000,
    submittedFrom: clientIp(req),
  };

  await db.attempt.update({
    where: { id: attempt.id },
    data: {
      status: expired ? ATTEMPT_STATUS.TIMED_OUT : ATTEMPT_STATUS.SUBMITTED,
      submissionTime: now,
      durationSeconds,
      flagsJson: JSON.stringify(flags),
      lastActivityAt: now,
    },
  });

  const { scoring, recommendation } = await scoreAndStoreAttempt(attempt.id);

  await logAudit({
    action: "ATTEMPT_SUBMITTED",
    entity: "Attempt",
    entityId: attempt.id,
    meta: {
      candidate: attempt.candidate.fullName,
      profile: recommendation.profileType,
      primary: recommendation.primaryCourseCode,
      confidence: recommendation.confidence,
      overall: scoring.overallScore,
    },
    ip: clientIp(req),
  });

  const reportPath = `/report/${attempt.token}`;
  const reportUrl = new URL(
    reportPath,
    process.env.APP_URL ?? req.nextUrl.origin,
  ).toString();
  await sendCandidateSubmittedEmail({
    to: attempt.candidate.email,
    name: attempt.candidate.fullName,
    reportUrl,
  });

  return NextResponse.json({
    ok: true,
    attemptToken: attempt.token,
    reportUrl: reportPath,
    timedOut: expired,
  });
});
