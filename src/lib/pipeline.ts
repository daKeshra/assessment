import { db } from "@/lib/db";
import { buildRecommendation } from "@/lib/recommendation";
import {
  getAllSettings,
  recommendationSettingsOf,
  scoringSettingsOf,
} from "@/lib/settings";
import { runScoring } from "@/lib/scoring";
import type { CourseInput, ResponseInput, SectionInput } from "@/lib/types";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Loads an attempt, runs the pure scoring + recommendation engines and
 * persists every derived score. Used on submission and whenever an
 * open-ended response is rubric-scored by staff (PRD §36).
 */
export async function scoreAndStoreAttempt(attemptId: string) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      responses: { include: { score: true } },
      version: {
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: {
              questions: {
                orderBy: { position: "asc" },
                include: {
                  options: { orderBy: { position: "asc" } },
                  competencies: { include: { competency: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!attempt) throw new Error(`Attempt ${attemptId} not found`);

  const settings = await getAllSettings();
  const courseRows = await db.course.findMany({
    where: { active: true },
    include: { competencyWeights: true },
    orderBy: { displayOrder: "asc" },
  });

  const sections: SectionInput[] = attempt.version.sections.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    component: s.component as SectionInput["component"],
    weight: s.weight,
    position: s.position,
    questions: s.questions.map((q) => ({
      id: q.id,
      sectionId: q.sectionId,
      type: q.type as SectionInput["questions"][number]["type"],
      difficulty: q.difficulty,
      active: q.active,
      requiresManualScore: q.requiresManualScore,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        position: o.position,
        isCorrect: o.isCorrect,
        score: o.score,
        map: parseJson(o.mapJson, null),
      })),
      competencies: q.competencies.map((c) => ({ code: c.competency.code, weight: c.weight })),
      items: parseJson(q.itemsJson, null),
    })),
  }));

  const responses: ResponseInput[] = attempt.responses.map((r) => ({
    questionId: r.questionId,
    selectedOptionIds: parseJson<string[]>(r.selectedOptionIds, []),
    textResponse: r.textResponse,
    // AI suggestions remain advisory until a staff member accepts or replaces
    // them. Only a recorded human rubric score enters the scoring pipeline.
    manualScore: r.score?.humanScore ?? null,
  }));

  // For open-ended questions keep the manual rubric score in sync.
  for (const r of attempt.responses) {
    const q = sections
      .flatMap((s) => s.questions)
      .find((qq) => qq.id === r.questionId);
    if (q?.requiresManualScore && r.score?.humanScore != null) {
      const existing = responses.find((x) => x.questionId === r.questionId);
      if (existing) existing.manualScore = r.score.humanScore;
    }
  }

  const competencyRowsAll = await db.competency.findMany();
  const competencyCodeById = Object.fromEntries(competencyRowsAll.map((c) => [c.id, c.code]));

  const courses: CourseInput[] = courseRows.map((c) => ({
    id: c.id,
    code: c.courseCode,
    name: c.courseName,
    description: c.description,
    careerFamily: c.careerFamily,
    ctaUrl: c.ctaUrl,
    progression: parseJson<string[]>(c.progressionJson, []),
    minimumScore: c.minimumScore,
    weights: Object.fromEntries(
      c.competencyWeights
        .map((w) => [competencyCodeById[w.competencyId] ?? "", w.weight] as [string, number])
        .filter(([code]) => code !== ""),
    ),
  }));

  const scoring = runScoring({
    sections,
    responses,
    courses,
    settings: scoringSettingsOf(settings),
  });

  const recommendation = buildRecommendation({
    courses,
    scoring,
    settings: recommendationSettingsOf(settings),
  });

  // Persist everything atomically.
  await db.$transaction([
    db.competencyScore.deleteMany({ where: { attemptId } }),
    db.courseScore.deleteMany({ where: { attemptId } }),
    db.recommendation.deleteMany({ where: { attemptId } }),
    db.assessmentReport.deleteMany({ where: { attemptId } }),
  ]);

  const codeToId = Object.fromEntries(competencyRowsAll.map((c) => [c.code, c.id]));

  if (Object.keys(scoring.competencyScores).length > 0) {
    await db.competencyScore.createMany({
      data: Object.entries(scoring.competencyScores).map(([code, score]) => ({
        attemptId,
        competencyId: codeToId[code],
        score,
      })),
    });
  }

  const rankedCodes = Object.entries(scoring.courseScores).sort((a, b) => b[1] - a[1]);
  const codeToCourseId = Object.fromEntries(courseRows.map((c) => [c.courseCode, c.id]));
  if (rankedCodes.length > 0) {
    await db.courseScore.createMany({
      data: rankedCodes.map(([code, score], idx) => ({
        attemptId,
        courseId: codeToCourseId[code],
        score,
        rank: idx + 1,
        fitJson: JSON.stringify(scoring.courseFits[code] ?? {}),
      })),
    });
  }

  await db.recommendation.create({
    data: {
      attemptId,
      primaryCourseId: recommendation.primaryCourseCode
        ? codeToCourseId[recommendation.primaryCourseCode]
        : null,
      secondaryCourseIds: JSON.stringify(recommendation.secondaryCourseCodes),
      profileType: recommendation.profileType,
      profileFamily: recommendation.profileFamily,
      confidence: recommendation.confidence,
      confidenceValue: recommendation.confidenceValue,
      explanationJson: JSON.stringify({
        reasons: recommendation.reasons,
        strengths: recommendation.strengths,
        interestNote: recommendation.interestNote,
        sharedStrengths: recommendation.sharedStrengths,
        explorerMessage: recommendation.explorerMessage,
      }),
    },
  });

  await db.assessmentReport.create({
    data: {
      attemptId,
      overallScore: scoring.overallScore,
      completeness: scoring.completeness,
      simulationScore: scoring.simulationScore,
      componentScoresJson: JSON.stringify(scoring.componentPerformance),
      sectionScoresJson: JSON.stringify(scoring.sectionScores),
    },
  });

  // Update per-response stored raw scores so admin review stays in sync.
  for (const resp of attempt.responses) {
    const raw = scoring.questionScores[resp.questionId];
    if (raw == null) continue;
    if (resp.score) {
      await db.responseScore.update({
        where: { id: resp.score.id },
        data: {
          rawScore: raw,
          finalScore:
            resp.score.humanScore != null
              ? (resp.score.humanScore / 4) * 100
              : raw,
        },
      });
    } else {
      await db.responseScore.create({
        data: { responseId: resp.id, attemptId, questionId: resp.questionId, rawScore: raw, finalScore: raw },
      });
    }
  }

  return { scoring, recommendation };
}
