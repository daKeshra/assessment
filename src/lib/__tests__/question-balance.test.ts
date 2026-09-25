import { describe, expect, it } from "vitest";
import { SECTIONS } from "../../../prisma/seed";
import { COMPETENCIES } from "@/lib/constants";

/**
 * Guards the assessment's measurement balance.
 *
 * The v1.2 question bank was rebalanced so that no competency is measured by a
 * single item, and so that the strongest and weakest competencies have a
 * comparable share of measurement weight. Without this guard, a later content
 * edit can silently reintroduce a 13x coverage gap and make cross-course
 * recommendations indefensible.
 */

/** Every competency must be measured by at least this many questions. */
const MIN_QUESTIONS_PER_COMPETENCY = 4;
/** Every competency must carry at least this much total mapping weight. */
const MIN_WEIGHT_MASS = 6;
/** No single competency may dominate the bank. */
const MAX_WEIGHT_MASS = 20;
/** Strongest / weakest competency measurement mass must stay within this ratio. */
const MAX_MASS_RATIO = 3;
const MIN_QUESTION_COUNT = 70;
const MAX_QUESTION_COUNT = 80;

type Coverage = { questions: number; mass: number };

function measureCoverage() {
  const coverage = new Map<string, Coverage>();
  let total = 0;

  for (const section of SECTIONS) {
    total += section.questions.length;
    for (const question of section.questions) {
      for (const [code, weight] of question.comps) {
        const entry = coverage.get(code) ?? { questions: 0, mass: 0 };
        entry.questions += 1;
        entry.mass += weight;
        coverage.set(code, entry);
      }
    }
  }

  return { coverage, total };
}

const { coverage, total } = measureCoverage();
const masses = [...coverage.values()].map((c) => c.mass);
const allCodes = COMPETENCIES.map((c) => c.code);

describe("seeded question bank balance", () => {
  it("keeps the total question count within the agreed range", () => {
    expect(total).toBeGreaterThanOrEqual(MIN_QUESTION_COUNT);
    expect(total).toBeLessThanOrEqual(MAX_QUESTION_COUNT);
  });

  it("maps every competency to at least one question", () => {
    for (const code of allCodes) {
      expect(coverage.get(code), `competency ${code} has no questions`).toBeDefined();
    }
  });

  it("gives every competency enough questions to be reliable", () => {
    for (const [code, c] of coverage) {
      expect(
        c.questions,
        `competency ${code} is measured by only ${c.questions} question(s)`,
      ).toBeGreaterThanOrEqual(MIN_QUESTIONS_PER_COMPETENCY);
    }
  });

  it("keeps every competency's measurement weight within target bounds", () => {
    for (const [code, c] of coverage) {
      expect(c.mass, `competency ${code} weight mass ${c.mass}`).toBeGreaterThanOrEqual(MIN_WEIGHT_MASS);
      expect(c.mass, `competency ${code} weight mass ${c.mass}`).toBeLessThanOrEqual(MAX_WEIGHT_MASS);
    }
  });

  it("keeps the strongest and weakest competencies within the mass ratio", () => {
    const ratio = Math.max(...masses) / Math.min(...masses);
    expect(ratio).toBeLessThanOrEqual(MAX_MASS_RATIO);
  });

  it("only maps competencies that exist", () => {
    for (const section of SECTIONS) {
      for (const question of section.questions) {
        for (const [code, weight] of question.comps) {
          expect(allCodes, `${section.code} question maps unknown competency ${code}`).toContain(code);
          expect(weight, `${section.code} maps ${code} with weight ${weight}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("gives every course interest-map reach within a comparable band", () => {
    const interestQuestions = SECTIONS.filter((s) => s.component === "INTEREST").flatMap((s) => s.questions);
    const reach = new Map<string, number>();

    for (const question of interestQuestions) {
      for (const option of question.options ?? []) {
        for (const [code, affinity] of Object.entries(option.map ?? {})) {
          reach.set(code, (reach.get(code) ?? 0) + affinity);
        }
      }
    }

    const maxReach = Math.max(...[...reach.values()].map((v) => v / interestQuestions.length));
    const minReach = Math.min(...[...reach.values()].map((v) => v / interestQuestions.length));

    // A course appearing in few options is structurally capped, so the spread
    // between the best- and worst-placed course must stay narrow.
    expect(maxReach - minReach).toBeLessThanOrEqual(30);
  });
});
