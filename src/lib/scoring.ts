import { COMPONENTS, LIKERT_LABELS, type Component } from "@/lib/constants";
import type {
  CourseInput,
  QuestionInput,
  ResponseInput,
  ScoringInput,
  ScoringResult,
  SectionInput,
} from "@/lib/types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Option id maps for a question, avoiding repeated JSON parsing in loops. */
function responseFor(responses: ResponseInput[], questionId: string): ResponseInput | undefined {
  return responses.find((r) => r.questionId === questionId);
}

/**
 * Step 1 (PRD §20): normalise a single question to 0..100.
 * Returns null when the question must be excluded from aggregation
 * (open-ended questions that have not been rubric-scored yet).
 */
export function scoreQuestion(
  q: QuestionInput,
  resp: ResponseInput | undefined,
): number | null {
  const answered =
    !!resp && (resp.selectedOptionIds.length > 0 || (resp.textResponse ?? "").trim().length > 0);

  switch (q.type) {
    case "OPEN_ENDED": {
      if (resp?.manualScore == null) return null; // awaiting review -> excluded
      return clamp01(resp.manualScore / 4) * 100;
    }
    case "LIKERT": {
      if (!answered) return 0;
      const opt = q.options.find((o) => o.id === resp!.selectedOptionIds[0]);
      if (!opt) return 0;
      // scale value stored on option.score: 1..5
      return (clamp01((opt.score - 1) / 4) || 0) * 100;
    }
    case "SCENARIO": {
      if (!answered) return 0;
      const opt = q.options.find((o) => o.id === resp!.selectedOptionIds[0]);
      if (!opt) return 0;
      // scenario options are scored 0..4
      return clamp01(opt.score / 4) * 100;
    }
    case "MULTIPLE_SELECT": {
      const correct = q.options.filter((o) => o.isCorrect);
      if (correct.length === 0) return null;
      if (!resp) return 0;
      const selected = new Set(resp.selectedOptionIds);
      if (selected.size === 0) return 0;
      let hits = 0;
      let misses = 0;
      for (const o of q.options) {
        const picked = selected.has(o.id);
        if (picked && o.isCorrect) hits += 1;
        else if (picked && !o.isCorrect) misses += 1;
      }
      const value = (hits - 0.5 * misses) / correct.length;
      return clamp01(value) * 100;
    }
    case "ORDERING": {
      if (!q.items || q.items.length === 0) return null;
      if (!resp || resp.selectedOptionIds.length < 2) return resp ? 0 : 0;
      // Pairwise (Kendall-style) agreement: share of item pairs in the right relative order.
      const givenIndex = new Map<string, number>();
      resp.selectedOptionIds.forEach((id, i) => givenIndex.set(id, i));
      const correctRank = new Map<string, number>();
      for (const it of q.items) correctRank.set(it.id, it.correctPosition);
      const ids = q.items.map((i) => i.id).filter((id) => givenIndex.has(id));
      if (ids.length < 2) return 0;
      let total = 0;
      let ok = 0;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i];
          const b = ids[j];
          total += 1;
          const givenOrder = givenIndex.get(a)! - givenIndex.get(b)!;
          const correctOrder = correctRank.get(a)! - correctRank.get(b)!;
          if (Math.sign(givenOrder) === Math.sign(correctOrder)) ok += 1;
        }
      }
      return total === 0 ? 0 : (ok / total) * 100;
    }
    case "MULTIPLE_CHOICE":
    case "VISUAL":
    default: {
      if (!answered) return 0;
      const correct = q.options.find((o) => o.isCorrect);
      if (!correct) return null;
      return resp!.selectedOptionIds.includes(correct.id) ? 100 : 0;
    }
  }
}

/** Step 2: aggregate question scores into competency scores (0..100). */
export function aggregateCompetencies(
  sections: SectionInput[],
  questionScores: Record<string, number | null>,
): Record<string, number> {
  const acc: Record<string, { total: number; weight: number }> = {};
  for (const section of sections) {
    for (const q of section.questions) {
      if (!q.active) continue;
      const raw = questionScores[q.id];
      if (raw == null) continue; // excluded (e.g. unscored open-ended)
      for (const m of q.competencies) {
        if (!acc[m.code]) acc[m.code] = { total: 0, weight: 0 };
        acc[m.code].total += raw * m.weight;
        acc[m.code].weight += m.weight;
      }
    }
  }
  const out: Record<string, number> = {};
  for (const [code, v] of Object.entries(acc)) {
    if (v.weight > 0) out[code] = round1(v.total / v.weight);
  }
  return out;
}

/** Section performance: mean of question raw scores (section weight applied later). */
export function computeSectionScores(
  sections: SectionInput[],
  questionScores: Record<string, number | null>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sections) {
    const values: number[] = [];
    for (const q of s.questions) {
      if (!q.active) continue;
      const raw = questionScores[q.id];
      if (raw != null) values.push(raw);
    }
    if (values.length > 0) {
      out[s.id] = round1(values.reduce((a, b) => a + b, 0) / values.length);
    }
  }
  return out;
}

/**
 * Component performance uses section weights (PRD §6) normalised inside
 * each component bucket.
 */
export function computeComponentPerformance(
  sections: SectionInput[],
  sectionScores: Record<string, number>,
): Record<string, number | null> {
  const buckets: Record<string, { total: number; weight: number }> = {};
  for (const s of sections) {
    const score = sectionScores[s.id];
    if (score == null) continue;
    if (!buckets[s.component]) buckets[s.component] = { total: 0, weight: 0 };
    buckets[s.component].total += score * s.weight;
    buckets[s.component].weight += s.weight;
  }
  const out: Record<string, number | null> = {};
  for (const comp of Object.values(COMPONENTS)) {
    const b = buckets[comp];
    out[comp] = b && b.weight > 0 ? round1(b.total / b.weight) : null;
  }
  return out;
}

/** Competencies that are actually assessed inside a component. */
function competenciesByComponent(sections: SectionInput[]): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const s of sections) {
    if (!out[s.component]) out[s.component] = new Set();
    for (const q of s.questions) {
      if (!q.active) continue;
      for (const m of q.competencies) out[s.component].add(m.code);
    }
  }
  return out;
}

/**
 * Step 3: course fit per component.
 * Fit = Σ(competency score × course weight) / Σ(course weight)
 * over competencies assessed in that component.
 */
export function computeCourseFits(
  sections: SectionInput[],
  responses: ResponseInput[],
  courses: CourseInput[],
  competencyScores: Record<string, number>,
  questionScores: Record<string, number | null>,
): Record<string, Record<string, number | null>> {
  const byComponent = competenciesByComponent(sections);

  // Interest component: affinity comes from career-interest option maps (PRD §16).
  const interestSections = sections.filter((s) => s.component === COMPONENTS.INTEREST);
  const interestQuestionIds = interestSections.flatMap((s) =>
    s.questions.filter((q) => q.active).map((q) => q.id),
  );

  const fits: Record<string, Record<string, number | null>> = {};

  for (const course of courses) {
    fits[course.code] = {};

    for (const comp of Object.values(COMPONENTS)) {
      if (comp === COMPONENTS.INTEREST) continue;

      const codes = byComponent[comp];
      let total = 0;
      let weight = 0;
      if (codes) {
        for (const code of codes) {
          const cw = course.weights[code] ?? 0;
          const cs = competencyScores[code];
          if (cw > 0 && cs != null) {
            total += cs * cw;
            weight += cw;
          }
        }
      }
      fits[course.code][comp] = weight > 0 ? round1(total / weight) : null;
    }

    // Interest fit
    if (interestQuestionIds.length > 0) {
      let sum = 0;
      for (const qid of interestQuestionIds) {
        const resp = responses.find((r) => r.questionId === qid);
        if (!resp || resp.selectedOptionIds.length === 0) continue;
        const q = sections
          .flatMap((s) => s.questions)
          .find((qq) => qq.id === qid);
        const opt = q?.options.find((o) => o.id === resp.selectedOptionIds[0]);
        const affinity = opt?.map?.courses?.[course.code];
        sum += typeof affinity === "number" ? clamp01(affinity / 100) * 100 : 0;
      }
      fits[course.code][COMPONENTS.INTEREST] = round1(sum / interestQuestionIds.length);
    } else {
      fits[course.code][COMPONENTS.INTEREST] = null;
    }
  }

  return fits;
}

/** Step 4: combine components with configurable weights into the final course score. */
function combine(
  fits: Record<string, number | null>,
  componentWeights: Record<string, number>,
): number | null {
  let total = 0;
  let weight = 0;
  let aptitudeWeight = 0;
  for (const [comp, w] of Object.entries(componentWeights)) {
    const fit = fits[comp];
    if (fit == null || !w) continue;
    total += fit * w;
    weight += w;
    if (comp !== COMPONENTS.INTEREST) aptitudeWeight += w;
  }
  // Interest is preference, not aptitude: if no aptitude component produced a
  // fit for this course, interest alone must not produce a course score.
  if (weight === 0 || aptitudeWeight === 0) return null;
  return round1(total / weight);
}

/** Full pipeline: raw scores -> competencies -> components -> courses. */
export function runScoring(input: ScoringInput): ScoringResult {
  const { sections, responses, courses, settings } = input;

  // Step 1
  const questionScores: Record<string, number | null> = {};
  let scorable = 0;
  let answeredScorable = 0;
  for (const s of sections) {
    for (const q of s.questions) {
      if (!q.active) continue;
      const resp = responseFor(responses, q.id);
      const raw = scoreQuestion(q, resp);
      questionScores[q.id] = raw;
      if (raw != null) {
        scorable += 1;
        const hasAnswer =
          !!resp && (resp.selectedOptionIds.length > 0 || (resp.textResponse ?? "").trim().length > 0);
        if (hasAnswer) answeredScorable += 1;
      }
    }
  }

  // Step 2
  const competencyScores = aggregateCompetencies(sections, questionScores);
  const sectionScores = computeSectionScores(sections, questionScores);
  const componentPerformance = computeComponentPerformance(sections, sectionScores);

  // Step 3
  const courseFits = computeCourseFits(sections, responses, courses, competencyScores, questionScores);

  // Step 4
  const courseScores: Record<string, number> = {};
  for (const course of courses) {
    const combined = combine(courseFits[course.code], settings.componentWeights);
    courseScores[course.code] = combined ?? 0;
  }

  // Overall score = weighted component performance
  let overallTotal = 0;
  let overallWeight = 0;
  for (const [comp, w] of Object.entries(settings.componentWeights)) {
    const perf = componentPerformance[comp];
    if (perf == null || !w) continue;
    overallTotal += perf * w;
    overallWeight += w;
  }
  const overallScore = overallWeight > 0 ? round1(overallTotal / overallWeight) : 0;

  return {
    questionScores,
    competencyScores,
    componentPerformance,
    sectionScores,
    courseFits,
    courseScores,
    overallScore,
    simulationScore: componentPerformance[COMPONENTS.SIMULATION] ?? 0,
    completeness: scorable > 0 ? round1(answeredScorable / scorable) : 0,
  };
}
