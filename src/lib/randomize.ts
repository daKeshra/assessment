/**
 * Deterministic per-attempt randomisation (PRD §25, §38).
 * The same attempt always reconstructs the same shuffled order, so a
 * candidate who resumes sees the order they started with, while different
 * candidates get different orders.
 */

/** FNV-1a string hash -> 32-bit int seed. */
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rnd = mulberry32(hashSeed(seed));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface AttemptOrders {
  /** sectionId -> question ids in presentation order */
  questionOrder: Record<string, string[]>;
  /** questionId -> option ids in presentation order (MC/scenario/visual/multi-select only) */
  optionOrder: Record<string, string[]>;
  /** questionId -> ordering item ids in presentation order */
  itemOrder: Record<string, string[]>;
}

export function buildAttemptOrders(opts: {
  attemptToken: string;
  sections: { id: string; questions: { id: string; type: string; options: { id: string }[]; items: { id: string }[] | null }[] }[];
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
}): AttemptOrders {
  const orders: AttemptOrders = { questionOrder: {}, optionOrder: {}, itemOrder: {} };
  const shuffleable = (t: string) => t !== "LIKERT"; // keep scale order stable

  for (const section of opts.sections) {
    const qids = section.questions.map((q) => q.id);
    orders.questionOrder[section.id] = opts.randomizeQuestions
      ? seededShuffle(qids, `${opts.attemptToken}:q:${section.id}`)
      : qids;
  }

  for (const section of opts.sections) {
    for (const q of section.questions) {
      if (q.options.length > 0 && shuffleable(q.type)) {
        const oids = q.options.map((o) => o.id);
        orders.optionOrder[q.id] = opts.randomizeOptions
          ? seededShuffle(oids, `${opts.attemptToken}:o:${q.id}`)
          : oids;
      }
      if (q.items && q.items.length > 0) {
        const iids = q.items.map((i) => i.id);
        orders.itemOrder[q.id] = seededShuffle(iids, `${opts.attemptToken}:i:${q.id}`);
      }
    }
  }

  return orders;
}
