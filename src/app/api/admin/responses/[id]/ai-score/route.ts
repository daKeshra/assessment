import { NextRequest, NextResponse } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { canScoreResponses, requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { AiScoringError, suggestRubricScore, type AiRubricResult } from "@/lib/ai-scoring";

/**
 * Generate an advisory AI rubric suggestion for one open-ended response.
 * The suggestion is stored separately from the human score and never silently
 * replaces a staff decision.
 */
export const POST = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession();
  if (!canScoreResponses(session.role)) {
    throw new HttpError(403, "Not allowed to score responses");
  }
  const { id } = await params;
  const limit = rateLimit(`ai-score:${session.id}:${id}`, { limit: 10, windowMs: 60_000 });
  if (!limit.ok) throw new HttpError(429, "Too many AI scoring requests; try again shortly");
  const response = await db.response.findUnique({
    where: { id },
    include: {
      score: true,
      attempt: { select: { status: true } },
      question: {
        include: {
          section: true,
          competencies: { include: { competency: true } },
        },
      },
    },
  });
  if (!response) throw new HttpError(404, "Response not found");
  if (!["SUBMITTED", "TIMED_OUT"].includes(response.attempt.status)) {
    throw new HttpError(409, "AI scoring is available after the candidate submits the assessment");
  }
  if (!response.question.requiresManualScore || response.question.type !== "OPEN_ENDED") {
    throw new HttpError(400, "AI scoring is only available for open-ended questions");
  }
  if (!response.textResponse?.trim()) {
    throw new HttpError(400, "There is no written response to score");
  }

  let suggestion: AiRubricResult;
  try {
    suggestion = await suggestRubricScore({
      question: response.question.prompt,
      section: `${response.question.section.code} · ${response.question.section.name}`,
      response: response.textResponse,
    });
  } catch (error) {
    if (error instanceof AiScoringError) {
      const status = error.code === "not_configured" ? 503 : 502;
      throw new HttpError(status, error.message, { code: error.code });
    }
    throw error;
  }

  const finalScore = response.score?.humanScore != null
    ? (response.score.humanScore / 4) * 100
    : null;

  if (response.score) {
    await db.responseScore.update({
      where: { id: response.score.id },
      data: {
        aiScore: suggestion.score,
        aiRationale: suggestion.rationale,
        aiConfidence: suggestion.confidence,
        aiModel: suggestion.model,
        aiGeneratedAt: new Date(),
        aiPromptVersion: "rubric-v1",
        finalScore: finalScore ?? 0,
      },
    });
  } else {
    await db.responseScore.create({
      data: {
        responseId: response.id,
        attemptId: response.attemptId,
        questionId: response.questionId,
        rawScore: finalScore ?? 0,
        aiScore: suggestion.score,
        aiRationale: suggestion.rationale,
        aiConfidence: suggestion.confidence,
        aiModel: suggestion.model,
        aiGeneratedAt: new Date(),
        aiPromptVersion: "rubric-v1",
        finalScore: finalScore ?? 0,
      },
    });
  }

  // The suggestion is stored as advisory metadata only. The report remains
  // unscored for this response until a staff member records a human rubric
  // score through /score.
  await logAudit({
    userId: session.id,
    action: "RESPONSE_AI_SCORED",
    entity: "Response",
    entityId: id,
    meta: {
      aiScore: suggestion.score,
      aiConfidence: suggestion.confidence,
      model: suggestion.model,
      attemptId: response.attemptId,
    },
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({
    ok: true,
    aiScore: suggestion.score,
    aiRationale: suggestion.rationale,
    aiConfidence: suggestion.confidence,
    model: suggestion.model,
    finalScore,
  });
});
