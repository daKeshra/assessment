import { COMPONENTS, COMPETENCY_CODE_TO_NAME, PROFILE_TYPES } from "@/lib/constants";
import type {
  CourseInput,
  RankedCourse,
  RecommendationResult,
  RecommendationSettings,
  ScoringResult,
} from "@/lib/types";

function strengthLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Developing";
  return "Emerging";
}

function clampConfidence(c: "HIGH" | "MODERATE" | "LOW", cap: "HIGH" | "MODERATE" | "LOW") {
  const order = { LOW: 0, MODERATE: 1, HIGH: 2 } as const;
  return order[c] > order[cap] ? cap : c;
}

/**
 * Pure recommendation engine (PRD §21-§24).
 *
 * Never returns "highest number wins" alone: it evaluates score level,
 * minimum thresholds, top-vs-second gaps, practical simulation performance,
 * completeness, multi-potential clusters and the Technology Explorer case.
 */
export function buildRecommendation(opts: {
  courses: CourseInput[];
  scoring: ScoringResult;
  settings: RecommendationSettings;
}): RecommendationResult {
  const { courses, scoring, settings } = opts;

  const ranked: RankedCourse[] = courses
    .map((c) => ({
      code: c.code,
      name: c.name,
      score: scoring.courseScores[c.code] ?? 0,
      careerFamily: c.careerFamily,
      minimumScore: c.minimumScore,
    }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const third = ranked[2] ?? null;
  const gap = top && second ? Math.round((top.score - second.score) * 10) / 10 : top ? top.score : 0;
  const topThreeSpread = top && third ? Math.round((top.score - third.score) * 10) / 10 : gap;

  // Each course carries its own editable recommendation threshold. The
  // global setting remains a fallback for legacy/custom course inputs.
  const topThreshold = top?.minimumScore ?? settings.minScore;
  const explorer = !top || top.score < topThreshold;
  const multiPath =
    !explorer &&
    ranked.length >= 3 &&
    topThreeSpread <= settings.multiPathRange &&
    ranked[2].score >= ranked[2].minimumScore;

  let profileType: RecommendationResult["profileType"] = PROFILE_TYPES.SINGLE;
  if (explorer) profileType = PROFILE_TYPES.EXPLORER;
  else if (multiPath) profileType = PROFILE_TYPES.MULTI_PATH;

  // ---------------- primary / secondary ----------------
  let primaryCourseCode: string | null = null;
  let secondaryCourseCodes: string[] = [];

  if (!explorer && top) {
    primaryCourseCode = top.code;
    const cutoff = Math.max(topThreshold, top.score - settings.secondaryRange);
    secondaryCourseCodes = ranked
      .filter(
        (c) =>
          c.code !== top.code && c.score >= c.minimumScore && c.score >= cutoff,
      )
      .slice(0, 3)
      .map((c) => c.code);
    if (multiPath) {
      // Show the whole cluster (up to 3 total).
      secondaryCourseCodes = ranked.slice(1, 3).map((c) => c.code);
    }
  } else if (explorer && ranked.length >= 2) {
    // Still surface closest areas to explore alongside the foundation program.
    secondaryCourseCodes = ranked.slice(0, 2).map((c) => c.code);
  }

  // ---------------- confidence ----------------
  let confidence: RecommendationResult["confidence"] = "LOW";
  if (
    top &&
    top.score >= topThreshold &&
    top.score >= settings.confidenceHighTop &&
    gap >= settings.confidenceHighGap &&
    scoring.simulationScore >= settings.confidenceHighPractical &&
    scoring.completeness >= settings.minCompletenessHigh
  ) {
    confidence = "HIGH";
  } else if (
    top &&
    top.score >= topThreshold &&
    gap >= settings.confidenceModerateGap &&
    scoring.completeness >= settings.minCompletenessModerate
  ) {
    confidence = "MODERATE";
  }
  if (profileType === PROFILE_TYPES.EXPLORER) {
    confidence = clampConfidence(confidence, top && top.score >= topThreshold - 10 ? "MODERATE" : "LOW");
  }
  if (profileType === PROFILE_TYPES.MULTI_PATH) {
    // A closely clustered top 3 (PRD §21/§22) resolves to Moderate confidence:
    // the cluster is real, but one single pathway is not clearly dominant.
    confidence = scoring.completeness >= settings.minCompletenessModerate ? "MODERATE" : "LOW";
  }

  const confidenceValue = Math.round(
    Math.min(
      100,
      ((top?.score ?? 0) * 0.4 +
        Math.min(gap, 20) * 2 +
        scoring.completeness * 20 +
        scoring.simulationScore * 0.2),
    ),
  );

  // ---------------- strengths ----------------
  const strengths = Object.entries(scoring.competencyScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([code, score]) => ({
      name: COMPETENCY_CODE_TO_NAME[code] ?? code,
      score,
      label: strengthLabel(score),
    }));

  // ---------------- reasons ----------------
  const reasons: string[] = [];
  const primaryCourse = courses.find((c) => c.code === primaryCourseCode);

  if (profileType === PROFILE_TYPES.EXPLORER) {
    reasons.push(
      `No pathway reached its minimum recommendation score yet${top ? ` (best: ${top.name}, ${top.minimumScore}/100)` : ""}. That is not a failure - it usually means your foundations are still forming.`,
    );
    reasons.push(
      "A structured digital foundations program will sharpen your problem-solving, tool familiarity and confidence before you commit to a specialisation.",
    );
    reasons.push(
      "After the foundation phase, retaking this assessment will give a much sharper recommendation.",
    );
  } else if (primaryCourse && top) {
    // 1) top competencies that matter most for this course
    const weightedCodes = Object.entries(primaryCourse.weights)
      .filter(([, w]) => w >= 4)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code)
      .filter((code) => scoring.competencyScores[code] != null)
      .sort((a, b) => (scoring.competencyScores[b] ?? 0) - (scoring.competencyScores[a] ?? 0))
      .slice(0, 2);

    for (const code of weightedCodes) {
      const s = scoring.competencyScores[code] ?? 0;
      if (s >= 60) {
        reasons.push(
          `Your ${COMPETENCY_CODE_TO_NAME[code] ?? code} score of ${Math.round(s)} is a core strength for ${top.name}.`,
        );
      }
    }

    // 2) practical simulation performance
    const sim = scoring.simulationScore;
    if (sim >= 75) {
      reasons.push(
        `You handled the practical problem-solving simulations very well (${Math.round(sim)}%), including scenarios close to real ${top.careerFamily ?? "technology"} work.`,
      );
    } else if (sim >= 60) {
      reasons.push(
        `Your practical simulation performance (${Math.round(sim)}%) shows you can work through realistic workplace problems.`,
      );
    }

    // 3) overall fit + gap
    if (second) {
      reasons.push(
        `${top.name} scored ${Math.round(top.score)}, just ahead of ${second.name} (${Math.round(second.score)}), making it the strongest single fit overall.`,
      );
    } else {
      reasons.push(`${top.name} is your highest-scoring pathway at ${Math.round(top.score)}.`);
    }

    // 4) interest alignment
    const interestFit = scoring.courseFits[top.code]?.[COMPONENTS.INTEREST] ?? 0;
    if (interestFit >= 60) {
      reasons.push(
        "The activities you found most interesting during the assessment align with this pathway.",
      );
    }

    if (multiPath) {
      const shared = sharedStrengthCodes(courses, ranked.slice(0, 3).map((r) => r.code), scoring);
      reasons.push(
        `You also scored strongly across ${ranked
          .slice(1, 3)
          .map((r) => r.name)
          .join(" and ")}, which share the same underlying strengths (${shared
          .map((c) => COMPETENCY_CODE_TO_NAME[c] ?? c)
          .join(", ")}).`,
      );
    }
  }

  if (scoring.completeness < 0.95) {
    reasons.push(
      `${Math.round((1 - scoring.completeness) * 100)}% of questions were left unanswered, so this recommendation may understate your ability.`,
    );
  }

  // ---------------- interest vs aptitude mismatch (PRD §50) ----------------
  let interestNote: string | null = null;
  const interestRanked = courses
    .map((c) => ({
      course: c,
      interest: scoring.courseFits[c.code]?.[COMPONENTS.INTEREST] ?? 0,
      aptitude: scoring.courseScores[c.code] ?? 0,
    }))
    .sort((a, b) => b.interest - a.interest);
  const mostInteresting = interestRanked[0];
  if (
    mostInteresting &&
    mostInteresting.interest >= 70 &&
    primaryCourseCode &&
    mostInteresting.course.code !== primaryCourseCode &&
    mostInteresting.aptitude < (top?.score ?? 0) - 12
  ) {
    interestNote = `Your interest in ${mostInteresting.course.name} is high, although your assessment performance suggests that ${top?.name} may currently align more closely with your strengths. Interest and effort can close that gap over time.`;
  }

  // ---------------- shared strengths for multi-path ----------------
  const sharedStrengths =
    profileType === PROFILE_TYPES.MULTI_PATH
      ? sharedStrengthCodes(courses, ranked.slice(0, 3).map((r) => r.code), scoring)
          .map((c) => COMPETENCY_CODE_TO_NAME[c] ?? c)
      : [];

  const profileFamily =
    profileType === PROFILE_TYPES.MULTI_PATH
      ? "Multi-Path Technology Profile"
      : (ranked[0]?.careerFamily ?? null);

  return {
    profileType,
    profileFamily,
    primaryCourseCode,
    secondaryCourseCodes,
    confidence,
    confidenceValue,
    reasons: reasons.slice(0, 5),
    strengths,
    interestNote,
    sharedStrengths,
    explorerMessage:
      profileType === PROFILE_TYPES.EXPLORER
        ? "Complete a foundational digital technology program before choosing a specialisation."
        : null,
  };
}

/** Competencies weighted highly by all of the given courses where the candidate scored well. */
function sharedStrengthCodes(
  courses: CourseInput[],
  codes: string[],
  scoring: ScoringResult,
): string[] {
  const selected = courses.filter((c) => codes.includes(c.code));
  if (selected.length === 0) return [];
  const tally = new Map<string, number>();
  for (const course of selected) {
    for (const [code, w] of Object.entries(course.weights)) {
      if (w >= 4) tally.set(code, (tally.get(code) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .filter(([code, count]) => count >= Math.min(2, selected.length) && (scoring.competencyScores[code] ?? 0) >= 60)
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code)
    .slice(0, 4);
}
