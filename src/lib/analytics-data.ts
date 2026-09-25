import { db } from "@/lib/db";
import {
  buildAnalytics,
  type AnalyticsAttempt,
  type AnalyticsSection,
  type AnalyticsSummary,
} from "@/lib/analytics";

function validDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function getAssessmentAnalytics(options: {
  from?: string | null;
  to?: string | null;
  versionId?: string | null;
  courseCode?: string | null;
  confidence?: string | null;
  status?: string | null;
} = {}): Promise<{ summary: AnalyticsSummary; attempts: AnalyticsAttempt[]; sections: AnalyticsSection[] }> {
  const from = validDate(options.from);
  const toDate = validDate(options.to);
  const to = toDate
    ? new Date(toDate.getTime() + (toDate.getTime() % 86_400_000 === 0 ? 86_399_999 : 0))
    : undefined;
  const versionId = options.versionId && options.versionId !== "ALL" ? options.versionId : undefined;
  const courseCode = options.courseCode && options.courseCode !== "ALL" ? options.courseCode : undefined;
  const confidence = options.confidence && options.confidence !== "ALL" ? options.confidence : undefined;
  const status = options.status && options.status !== "ALL" ? options.status : undefined;

  const [rows, sections] = await Promise.all([
    db.attempt.findMany({
      where: {
        startTime: { gte: from, lte: to },
        assessmentVersionId: versionId,
        status,
        recommendation:
          courseCode || confidence
            ? {
                ...(courseCode ? { primaryCourse: { courseCode } } : {}),
                ...(confidence ? { confidence } : {}),
              }
            : undefined,
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        status: true,
        startTime: true,
        lastActivityAt: true,
        submissionTime: true,
        durationSeconds: true,
        flagsJson: true,
        version: { select: { versionName: true, versionNumber: true } },
        report: {
          select: {
            overallScore: true,
            completeness: true,
            simulationScore: true,
            componentScoresJson: true,
            sectionScoresJson: true,
          },
        },
        recommendation: {
          select: {
            profileType: true,
            confidence: true,
            primaryCourse: { select: { courseName: true, careerFamily: true } },
          },
        },
        competencyScores: {
          select: {
            score: true,
            competency: { select: { code: true, name: true } },
          },
        },
        events: { select: { type: true } },
        responses: {
          select: {
            textResponse: true,
            question: {
              select: {
                id: true,
                prompt: true,
                difficulty: true,
                requiresManualScore: true,
                section: { select: { id: true, code: true, name: true } },
              },
            },
            score: { select: { finalScore: true, aiScore: true, humanScore: true } },
          },
        },
      },
    }),
    db.section.findMany({
      where: { assessmentVersionId: versionId },
      orderBy: { position: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const attempts: AnalyticsAttempt[] = rows.map((row) => ({
    id: row.id,
    status: row.status,
    startTime: row.startTime,
    lastActivityAt: row.lastActivityAt,
    submissionTime: row.submissionTime,
    durationSeconds: row.durationSeconds,
    flagsJson: row.flagsJson,
    versionName: row.version.versionName,
    versionNumber: row.version.versionNumber,
    report: row.report,
    recommendation: row.recommendation,
    competencyScores: row.competencyScores,
    events: row.events,
    responses: row.responses,
  }));

  return { summary: buildAnalytics(attempts, sections), attempts, sections };
}
