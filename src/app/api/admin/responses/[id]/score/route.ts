import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { canScoreResponses, requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendCandidateProfileEmail } from "@/lib/email";
import { scoreAndStoreAttempt } from "@/lib/pipeline";
import { humanScoreSchema } from "@/lib/validation";

/**
 * Record the staff member's final rubric score (0..4). This always overrides
 * any advisory AI suggestion and re-runs the scoring pipeline so reports stay
 * in sync (PRD §36).
 */
export const PATCH = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession();
  if (!canScoreResponses(session.role)) throw new HttpError(403, "Not allowed to score responses");

  const { id } = await params;
  const body = humanScoreSchema.parse(await parseJson(req));

  const response = await db.response.findUnique({
    where: { id },
    include: { score: true, question: true, attempt: { include: { candidate: true } } },
  });
  if (!response) throw new HttpError(404, "Response not found");
  if (!["SUBMITTED", "TIMED_OUT"].includes(response.attempt.status)) {
    throw new HttpError(409, "Responses can be scored after the candidate submits the assessment");
  }
  if (!response.question.requiresManualScore) {
    throw new HttpError(400, "This question is not manually scored");
  }

  const wasReviewed = response.score?.humanScore != null;
  const finalScore = (body.humanScore / 4) * 100;

  if (response.score) {
    await db.responseScore.update({
      where: { id: response.score.id },
      data: {
        humanScore: body.humanScore,
        finalScore,
        reviewedById: session.id,
        reviewedAt: new Date(),
      },
    });
  } else {
    await db.responseScore.create({
      data: {
        responseId: response.id,
        attemptId: response.attemptId,
        questionId: response.questionId,
        rawScore: finalScore,
        humanScore: body.humanScore,
        finalScore,
        reviewedById: session.id,
        reviewedAt: new Date(),
      },
    });
  }

  await scoreAndStoreAttempt(response.attemptId);

  if (!wasReviewed) {
    const remainingWrittenResponses = await db.response.findMany({
      where: { attemptId: response.attemptId, question: { requiresManualScore: true } },
      select: {
        textResponse: true,
        score: { select: { humanScore: true } },
      },
    });
    const hasPendingReview = remainingWrittenResponses.some(
      (item) =>
        Boolean(item.textResponse?.trim()) &&
        (item.score == null || item.score.humanScore == null),
    );
    if (!hasPendingReview) {
      const reportUrl = new URL(
        `/report/${response.attempt.token}`,
        process.env.APP_URL ?? req.nextUrl.origin,
      ).toString();
      await sendCandidateProfileEmail({
        to: response.attempt.candidate.email,
        name: response.attempt.candidate.fullName,
        reportUrl,
      });
    }
  }

  await logAudit({
    userId: session.id,
    action: "RESPONSE_SCORED",
    entity: "Response",
    entityId: id,
    meta: { humanScore: body.humanScore, attemptId: response.attemptId },
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true, humanScore: body.humanScore, finalScore });
});
