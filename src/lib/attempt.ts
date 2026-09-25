import type { Prisma } from "@prisma/client";
import { SETTING_KEYS, TIMER_MODES } from "@/lib/constants";
import { db } from "@/lib/db";
import type { AttemptOrders } from "@/lib/randomize";
import { boolOf, numOf, type SettingsMap } from "@/lib/settings";

export const attemptInclude = {
  candidate: true,
  assessment: true,
  version: {
    include: {
      sections: {
        orderBy: { position: "asc" as const },
        include: {
          questions: {
            orderBy: { position: "asc" as const },
            include: { options: { orderBy: { position: "asc" as const } } },
          },
        },
      },
    },
  },
  responses: true,
  report: true,
  recommendation: { include: { primaryCourse: true } },
} satisfies Prisma.AttemptInclude;

export type AttemptGraph = Prisma.AttemptGetPayload<{ include: typeof attemptInclude }>;

export async function loadAttempt(token: string): Promise<AttemptGraph | null> {
  return db.attempt.findUnique({ where: { token }, include: attemptInclude });
}

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Timing (PRD §26)
// ---------------------------------------------------------------------------

export function timerModeOf(settings: SettingsMap): string {
  return settings[SETTING_KEYS.TIMER_MODE] ?? TIMER_MODES.OVERALL;
}

export function durationMinutesOf(settings: SettingsMap): number {
  return numOf(settings, SETTING_KEYS.DURATION_MINUTES, 60);
}

export function allowBackOf(settings: SettingsMap): boolean {
  return boolOf(settings, SETTING_KEYS.ALLOW_BACK, true);
}

/** Seconds left on the overall timer, or null when the mode is not OVERALL. */
export function overallRemainingSeconds(
  settings: SettingsMap,
  startTime: Date,
  now: Date = new Date(),
): number | null {
  if (timerModeOf(settings) !== TIMER_MODES.OVERALL) return null;
  const total = durationMinutesOf(settings) * 60;
  const elapsed = (now.getTime() - startTime.getTime()) / 1000;
  return Math.max(0, Math.round(total - elapsed));
}

/** Per-section allotment in SECTION mode (total duration split across sections). */
export function sectionAllotmentSeconds(
  settings: SettingsMap,
  sectionCount: number,
): number | null {
  if (timerModeOf(settings) !== TIMER_MODES.SECTION) return null;
  const total = durationMinutesOf(settings) * 60;
  return Math.max(60, Math.ceil(total / Math.max(1, sectionCount)));
}

export function sectionStartsOf(attempt: AttemptGraph): Record<string, number> {
  return parse<Record<string, number>>(attempt.sectionStartsJson, {});
}

/** Seconds left for a section, or null when not started / mode is not SECTION. */
export function sectionRemainingSeconds(
  attempt: AttemptGraph,
  sectionId: string,
  settings: SettingsMap,
  sectionCount: number,
  now: Date = new Date(),
): number | null {
  if (timerModeOf(settings) !== TIMER_MODES.SECTION) return null;
  const start = sectionStartsOf(attempt)[sectionId];
  if (!start) return null;
  const allot = sectionAllotmentSeconds(settings, sectionCount) ?? 0;
  return Math.max(0, Math.round(allot - (now.getTime() - start) / 1000));
}

export function allowedTotalSeconds(settings: SettingsMap, sectionCount: number): number {
  const mode = timerModeOf(settings);
  if (mode === TIMER_MODES.NONE) return 0;
  if (mode === TIMER_MODES.SECTION) {
    return (sectionAllotmentSeconds(settings, sectionCount) ?? 0) * sectionCount;
  }
  return durationMinutesOf(settings) * 60;
}

// ---------------------------------------------------------------------------
// Engine payload - whitelist only. Candidates never receive correct answers,
// competency tags, option maps or weights (PRD §37).
// ---------------------------------------------------------------------------

export interface EngineQuestion {
  id: string;
  sectionId: string;
  type: string;
  prompt: string;
  stimulus: string | null;
  stimulusSvg: string | null;
  requiresManualScore: boolean;
  options: { id: string; text: string }[];
  items: { id: string; text: string }[] | null;
}

export interface EngineSection {
  id: string;
  code: string;
  name: string;
  description: string | null;
  component: string;
  questionIds: string[];
}

export function buildEnginePayload(attempt: AttemptGraph, settings: SettingsMap) {
  const questionOrders = parse<AttemptOrders["questionOrder"]>(attempt.questionOrderJson, {});
  const optionOrders = parse<AttemptOrders["optionOrder"]>(attempt.optionOrderJson, {});
  const itemOrders = parse<AttemptOrders["itemOrder"]>(attempt.itemOrderJson, {});

  const sections: EngineSection[] = [];
  const questionById = new Map<string, EngineQuestion>();
  const flatOrder: string[] = [];

  for (const section of attempt.version.sections) {
    const active = section.questions.filter((q) => q.active);
    const byId = new Map(active.map((q) => [q.id, q]));
    const orderedIds = (questionOrders[section.id] ?? active.map((q) => q.id)).filter((id) =>
      byId.has(id),
    );
    // include any question missing from the snapshot (admin added after start)
    for (const q of active) if (!orderedIds.includes(q.id)) orderedIds.push(q.id);

    for (const qid of orderedIds) {
      const q = byId.get(qid)!;
      const optsById = new Map(q.options.map((o) => [o.id, o]));
      const optionIds = (optionOrders[q.id] ?? q.options.map((o) => o.id)).filter((id) =>
        optsById.has(id),
      );

      const itemsRaw = parse<{ id: string; text: string; correctPosition: number }[] | null>(
        q.itemsJson,
        null,
      );
      let items: { id: string; text: string }[] | null = null;
      if (itemsRaw && itemsRaw.length > 0) {
        const itemById = new Map(itemsRaw.map((i) => [i.id, i]));
        const itemIds = (itemOrders[q.id] ?? itemsRaw.map((i) => i.id)).filter((id) =>
          itemById.has(id),
        );
        items = itemIds.map((id) => ({ id, text: itemById.get(id)!.text })); // correctPosition stripped
      }

      questionById.set(q.id, {
        id: q.id,
        sectionId: q.sectionId,
        type: q.type,
        prompt: q.prompt,
        stimulus: q.stimulus,
        stimulusSvg: q.stimulusSvg,
        requiresManualScore: q.requiresManualScore,
        options: optionIds.map((id) => {
          const o = optsById.get(id)!;
          return { id: o.id, text: o.text }; // isCorrect / score / map stripped
        }),
        items,
      });
      flatOrder.push(q.id);
    }

    sections.push({
      id: section.id,
      code: section.code,
      name: section.name,
      description: section.description,
      component: section.component,
      questionIds: orderedIds,
    });
  }

  const responses: Record<string, { selectedOptionIds: string[]; textResponse: string | null }> =
    {};
  for (const r of attempt.responses) {
    responses[r.questionId] = {
      selectedOptionIds: parse<string[]>(r.selectedOptionIds, []),
      textResponse: r.textResponse,
    };
  }

  let currentIndex = attempt.currentQuestionId
    ? flatOrder.indexOf(attempt.currentQuestionId)
    : -1;
  if (currentIndex < 0) {
    // first unanswered question, else 0
    currentIndex = Math.max(0, flatOrder.findIndex((id) => !(id in responses)));
  }

  const sectionCount = sections.length;
  const answeredCount = flatOrder.filter((id) => {
    const r = responses[id];
    return r && (r.selectedOptionIds.length > 0 || (r.textResponse ?? "").trim().length > 0);
  }).length;

  const now = new Date();
  const currentSectionId = sections.find((s) => s.questionIds.includes(flatOrder[currentIndex] ?? ""))
    ?.id;

  return {
    attempt: {
      token: attempt.token,
      status: attempt.status,
      startedAt: attempt.startTime.toISOString(),
      serverNow: now.toISOString(),
    },
    candidate: { fullName: attempt.candidate.fullName },
    config: {
      timerMode: timerModeOf(settings),
      durationMinutes: durationMinutesOf(settings),
      allowBack: allowBackOf(settings),
      sectionCount,
      totalQuestions: flatOrder.length,
      answeredCount,
      sectionAllotmentSeconds: sectionAllotmentSeconds(settings, sectionCount),
      sectionStarts: sectionStartsOf(attempt),
    },
    sections,
    questions: flatOrder.map((id) => questionById.get(id)!).filter(Boolean),
    responses,
    currentIndex,
    remainingSeconds: overallRemainingSeconds(settings, attempt.startTime, now),
    currentSectionId: currentSectionId ?? sections[0]?.id ?? null,
  };
}
