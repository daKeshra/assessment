import { DISCLAIMER, PROFILE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { scoreAndStoreAttempt } from "@/lib/pipeline";
import { attemptInclude, type AttemptGraph } from "@/lib/attempt";

export interface StudentReport {
  candidateFirstName: string;
  completedAt: string | null;
  durationMinutes: number | null;
  profileType: string;
  profileLabel: string;
  profileFamily: string | null;
  multiPath: boolean;
  primary: {
    code: string;
    name: string;
    description: string | null;
    ctaUrl: string | null;
    progression: string[];
  } | null;
  why: string[];
  strengths: { name: string; label: string }[];
  secondaries: { code: string; name: string; description: string | null; ctaUrl: string | null }[];
  interestNote: string | null;
  explorerMessage: string | null;
  sharedStrengths: string[];
  disclaimer: string;
}

async function reload(token: string): Promise<AttemptGraph | null> {
  return db.attempt.findUnique({ where: { token }, include: attemptInclude });
}

/**
 * Student-facing report (PRD §32). Contains no internal data: no correct
 * answers, no numeric competency/course scores, no weights, no confidence.
 */
export async function buildStudentReport(token: string): Promise<StudentReport | null> {
  let attempt = await reload(token);
  if (!attempt) return null;

  const completed =
    attempt.status === "SUBMITTED" || attempt.status === "TIMED_OUT";
  if (!completed) return null;

  // Lazy (re)score if missing - e.g. open-ended answers reviewed afterwards.
  if (!attempt.report || !attempt.recommendation) {
    await scoreAndStoreAttempt(attempt.id);
    attempt = await reload(token);
    if (!attempt?.report || !attempt?.recommendation) return null;
  }

  const rec = attempt.recommendation;
  const report = attempt.report!;
  const explanation = JSON.parse(
    rec.explanationJson ?? "{}",
  ) as {
    reasons?: string[];
    strengths?: { name: string; label: string }[];
    interestNote?: string | null;
    sharedStrengths?: string[];
    explorerMessage?: string | null;
  };

  const courseScores = await db.courseScore.findMany({
    where: { attemptId: attempt.id },
    orderBy: { rank: "asc" },
    include: { course: true },
  });

  const secondaryCodes = JSON.parse(rec.secondaryCourseIds ?? "[]") as string[];
  const secondaries = secondaryCodes
    .map((code) => courseScores.find((c) => c.course.courseCode === code)?.course)
    .filter(Boolean)
    .map((c) => ({
      code: c!.courseCode,
      name: c!.courseName,
      description: c!.description,
      ctaUrl: c!.ctaUrl,
    }));

  const primaryCourse = rec.primaryCourseId
    ? courseScores.find((c) => c.courseId === rec.primaryCourseId)?.course
    : null;

  return {
    candidateFirstName: attempt.candidate.fullName.split(" ")[0] ?? attempt.candidate.fullName,
    completedAt: attempt.submissionTime?.toISOString() ?? null,
    durationMinutes: attempt.durationSeconds ? Math.round(attempt.durationSeconds / 60) : null,
    profileType: rec.profileType,
    profileLabel:
      PROFILE_LABELS[rec.profileType] ??
      (rec.profileType === "SINGLE" && primaryCourse ? primaryCourse.courseName : "Your Profile"),
    profileFamily: rec.profileFamily,
    multiPath: rec.profileType === "MULTI_PATH",
    primary: primaryCourse
      ? {
          code: primaryCourse.courseCode,
          name: primaryCourse.courseName,
          description: primaryCourse.description,
          ctaUrl: primaryCourse.ctaUrl,
          progression: JSON.parse(primaryCourse.progressionJson ?? "[]") as string[],
        }
      : rec.profileType === "MULTI_PATH" && secondaries[0]
        ? {
            code: secondaries[0].code,
            name: secondaries[0].name,
            description: secondaries[0].description,
            ctaUrl: secondaries[0].ctaUrl,
            progression: [],
          }
        : null,
    why: explanation.reasons ?? [],
    strengths: (explanation.strengths ?? []).slice(0, 6),
    secondaries:
      rec.profileType === "MULTI_PATH" ? secondaries.slice(0, 3) : secondaries.slice(0, 3),
    interestNote: explanation.interestNote ?? null,
    explorerMessage: explanation.explorerMessage ?? null,
    sharedStrengths: explanation.sharedStrengths ?? [],
    disclaimer: DISCLAIMER,
  };
}
