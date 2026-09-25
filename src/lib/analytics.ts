/** Pure aggregation helpers for the staff assessment analytics view. */

export interface AnalyticsAttempt {
  id: string;
  status: string;
  startTime: Date;
  lastActivityAt: Date;
  submissionTime: Date | null;
  durationSeconds: number | null;
  flagsJson: string | null;
  versionName: string;
  versionNumber: string;
  report: {
    overallScore: number;
    completeness: number;
    simulationScore: number | null;
    componentScoresJson: string | null;
    sectionScoresJson: string | null;
  } | null;
  recommendation: {
    profileType: string;
    confidence: string;
    primaryCourse: { courseName: string; careerFamily: string | null } | null;
  } | null;
  competencyScores: { score: number; competency: { code: string; name: string } }[];
  events: { type: string }[];
  responses: {
    textResponse: string | null;
    question: {
      id: string;
      prompt: string;
      difficulty: number;
      requiresManualScore: boolean;
      section: { id: string; code: string; name: string };
    };
    score: { finalScore: number; aiScore: number | null; humanScore: number | null } | null;
  }[];
}

export interface AnalyticsSection {
  id: string;
  code: string;
  name: string;
}

export interface AnalyticsSummary {
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  abandonedAttempts: number;
  completionRate: number;
  scoredAttempts: number;
  averageScore: number | null;
  averageCompleteness: number | null;
  averageDurationMinutes: number | null;
  scoreBands: { label: string; min: number; max: number; count: number }[];
  dailyTrend: { date: string; attempts: number; completed: number }[];
  sectionAverages: { id: string; code: string; name: string; average: number | null; count: number }[];
  componentAverages: { component: string; average: number | null; count: number }[];
  competencyAverages: { code: string; name: string; average: number | null; count: number }[];
  difficultyAverages: { difficulty: number; label: string; average: number | null; count: number }[];
  recommendationDistribution: { name: string; count: number }[];
  careerFamilyDistribution: { name: string; count: number }[];
  profileDistribution: { name: string; count: number }[];
  confidenceDistribution: { name: string; count: number }[];
  versionBreakdown: { version: string; attempts: number; completed: number; averageScore: number | null }[];
  questionPerformance: {
    id: string;
    prompt: string;
    section: string;
    difficulty: number;
    average: number;
    count: number;
  }[];
  integrityFlags: { name: string; count: number }[];
  pendingAiReview: number;
  ctaClicks: number;
  recommendationAcceptanceRate: number | null;
  eventDistribution: { name: string; count: number }[];
}

const COMPLETED = new Set(["SUBMITTED", "TIMED_OUT"]);
const SCORE_BANDS = [
  { label: "0–39", min: 0, max: 39 },
  { label: "40–59", min: 40, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 },
  { label: "90–100", min: 90, max: 100 },
];
const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Moderate",
  3: "Hard",
};

function parseRecord(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => typeof item === "number" && Number.isFinite(item))
        .map(([key, item]) => [key, Number(item)]),
    );
  } catch {
    return {};
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number | null, digits = 1): number | null {
  if (value == null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countMap(values: string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function addAverage<T extends string | number>(
  target: Map<T, { name: string; sum: number; count: number }>,
  key: T,
  name: string,
  value: number,
) {
  const current = target.get(key) ?? { name, sum: 0, count: 0 };
  current.sum += value;
  current.count += 1;
  target.set(key, current);
}

export function buildAnalytics(
  attempts: AnalyticsAttempt[],
  sections: AnalyticsSection[],
): AnalyticsSummary {
  const completedAttempts = attempts.filter((attempt) => COMPLETED.has(attempt.status));
  const reports = attempts.flatMap((attempt) => (attempt.report ? [attempt] : []));
  const scoredReports = completedAttempts.filter((attempt) => attempt.report);

  const scoreBands = SCORE_BANDS.map((band) => ({
    ...band,
    count: scoredReports.filter((attempt) => {
      const score = attempt.report?.overallScore ?? -1;
      return score >= band.min && score <= band.max;
    }).length,
  }));

  const daily = new Map<string, { attempts: number; completed: number }>();
  for (const attempt of attempts) {
    const key = dateKey(attempt.startTime);
    const row = daily.get(key) ?? { attempts: 0, completed: 0 };
    row.attempts += 1;
    if (COMPLETED.has(attempt.status)) row.completed += 1;
    daily.set(key, row);
  }

  const sectionTotals = new Map<string, { name: string; sum: number; count: number }>();
  for (const section of sections) {
    sectionTotals.set(section.id, { name: section.name, sum: 0, count: 0 });
  }
  const componentTotals = new Map<string, { name: string; sum: number; count: number }>();
  const competencyTotals = new Map<string, { name: string; sum: number; count: number }>();
  const difficultyTotals = new Map<number, { name: string; sum: number; count: number }>();
  const questionTotals = new Map<
    string,
    { prompt: string; section: string; difficulty: number; sum: number; count: number }
  >();

  for (const attempt of reports) {
    const report = attempt.report;
    if (!report) continue;
    for (const [id, score] of Object.entries(parseRecord(report.sectionScoresJson))) {
      const section = sections.find((candidate) => candidate.id === id);
      if (!section) continue;
      addAverage(sectionTotals, id, section.name, score);
    }
    for (const [component, score] of Object.entries(parseRecord(report.componentScoresJson))) {
      addAverage(componentTotals, component, component, score);
    }
    for (const competency of attempt.competencyScores) {
      addAverage(
        competencyTotals,
        competency.competency.code,
        competency.competency.name,
        competency.score,
      );
    }
    for (const response of attempt.responses) {
      if (!response.score) continue;
      const score = response.score.finalScore;
      addAverage(
        difficultyTotals,
        response.question.difficulty,
        DIFFICULTY_LABELS[response.question.difficulty] ?? "Unknown",
        score,
      );
      const question = questionTotals.get(response.question.id) ?? {
        prompt: response.question.prompt,
        section: response.question.section.name,
        difficulty: response.question.difficulty,
        sum: 0,
        count: 0,
      };
      question.sum += score;
      question.count += 1;
      questionTotals.set(response.question.id, question);
    }
  }

  // If a report is missing, section analytics can still use scored responses.
  for (const attempt of attempts) {
    if (Object.keys(parseRecord(attempt.report?.sectionScoresJson ?? null)).length > 0) continue;
    for (const response of attempt.responses) {
      if (!response.score) continue;
      addAverage(
        sectionTotals,
        response.question.section.id,
        response.question.section.name,
        response.score.finalScore,
      );
    }
  }

  const versionMap = new Map<
    string,
    { attempts: number; completed: number; scores: number[] }
  >();
  for (const attempt of attempts) {
    const version = `${attempt.versionName} v${attempt.versionNumber}`;
    const row = versionMap.get(version) ?? { attempts: 0, completed: 0, scores: [] };
    row.attempts += 1;
    if (COMPLETED.has(attempt.status)) row.completed += 1;
    if (attempt.report) row.scores.push(attempt.report.overallScore);
    versionMap.set(version, row);
  }

  const flagCounts = new Map<string, number>();
  for (const attempt of attempts) {
    if (!attempt.flagsJson) continue;
    try {
      const flags = JSON.parse(attempt.flagsJson) as Record<string, unknown>;
      for (const key of ["rapidCompletion", "inactiveNearEnd", "autoSubmitted"]) {
        if (flags[key] === true) flagCounts.set(key, (flagCounts.get(key) ?? 0) + 1);
      }
    } catch {
      // Ignore malformed legacy metadata; the assessment result remains usable.
    }
  }

  const eventTypes = attempts.flatMap((attempt) => attempt.events.map((event) => event.type));
  const ctaClicks = attempts.filter((attempt) =>
    attempt.events.some((event) => event.type === "CTA_CLICKED"),
  ).length;
  const recommendationAcceptanceRate = reports.length ? ctaClicks / reports.length : null;

  const pendingAiReview = completedAttempts.reduce((count, attempt) => {
    return (
      count +
      attempt.responses.filter((response) => {
        if (!response.question.requiresManualScore) return false;
        const hasText = Boolean(response.textResponse?.trim());
        if (!hasText) return false;
        return (
          !response.score ||
          (response.score.aiScore != null && response.score.humanScore == null)
        );
      }).length
    );
  }, 0);

  const questionPerformance = [...questionTotals.entries()]
    .map(([id, value]) => ({
      id,
      prompt: value.prompt,
      section: value.section,
      difficulty: value.difficulty,
      average: rounded(value.sum / value.count, 1) ?? 0,
      count: value.count,
    }))
    .sort((a, b) => a.average - b.average || b.count - a.count);

  return {
    totalAttempts: attempts.length,
    completedAttempts: completedAttempts.length,
    inProgressAttempts: attempts.filter((attempt) => attempt.status === "IN_PROGRESS").length,
    abandonedAttempts: attempts.filter((attempt) => attempt.status === "ABANDONED").length,
    completionRate: attempts.length ? completedAttempts.length / attempts.length : 0,
    scoredAttempts: scoredReports.length,
    averageScore: rounded(average(scoredReports.map((attempt) => attempt.report?.overallScore ?? 0))),
    averageCompleteness: rounded(
      average(scoredReports.map((attempt) => attempt.report?.completeness ?? 0)),
      3,
    ),
    averageDurationMinutes: rounded(
      average(completedAttempts.map((attempt) => (attempt.durationSeconds ?? 0) / 60)),
    ),
    scoreBands,
    dailyTrend: [...daily.entries()]
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    sectionAverages: sections.map((section) => {
      const value = sectionTotals.get(section.id);
      return {
        id: section.id,
        code: section.code,
        name: section.name,
        average: value && value.count > 0 ? rounded(value.sum / value.count) : null,
        count: value?.count ?? 0,
      };
    }),
    componentAverages: [...componentTotals.entries()].map(([component, value]) => ({
      component,
      average: rounded(value.sum / value.count),
      count: value.count,
    })),
    competencyAverages: [...competencyTotals.entries()].map(([code, value]) => ({
      code,
      name: value.name,
      average: rounded(value.sum / value.count),
      count: value.count,
    })),
    difficultyAverages: [1, 2, 3].map((difficulty) => {
      const value = difficultyTotals.get(difficulty);
      return {
        difficulty,
        label: DIFFICULTY_LABELS[difficulty],
        average: value ? rounded(value.sum / value.count) : null,
        count: value?.count ?? 0,
      };
    }),
    recommendationDistribution: countMap(
      reports.flatMap((attempt) => [
        attempt.recommendation?.primaryCourse?.courseName ?? "Technology Explorer",
      ]),
    ),
    careerFamilyDistribution: countMap(
      reports.flatMap((attempt) => [
        attempt.recommendation?.primaryCourse?.careerFamily ?? "Technology Explorer",
      ]),
    ),
    profileDistribution: countMap(
      reports.flatMap((attempt) => [attempt.recommendation?.profileType ?? "UNSCORED"]),
    ),
    confidenceDistribution: countMap(
      reports.flatMap((attempt) => [attempt.recommendation?.confidence ?? "UNSCORED"]),
    ),
    versionBreakdown: [...versionMap.entries()].map(([version, value]) => ({
      version,
      attempts: value.attempts,
      completed: value.completed,
      averageScore: rounded(average(value.scores)),
    })),
    questionPerformance,
    integrityFlags: [...flagCounts.entries()].map(([name, count]) => ({ name, count })),
    pendingAiReview,
    ctaClicks,
    recommendationAcceptanceRate: rounded(recommendationAcceptanceRate, 3),
    eventDistribution: countMap(eventTypes),
  };
}
