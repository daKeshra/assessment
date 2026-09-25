import { describe, expect, it } from "vitest";
import { runScoring, scoreQuestion } from "@/lib/scoring";
import type {
  CourseInput,
  OptionInput,
  QuestionInput,
  ResponseInput,
  SectionInput,
} from "@/lib/types";

function opt(partial: Partial<OptionInput> & { id: string; text?: string }): OptionInput {
  return {
    text: partial.text ?? partial.id,
    position: partial.position ?? 0,
    isCorrect: partial.isCorrect ?? false,
    score: partial.score ?? 0,
    map: partial.map ?? null,
    id: partial.id,
  };
}

function q(partial: Partial<QuestionInput> & { id: string; type: QuestionInput["type"] }): QuestionInput {
  return {
    sectionId: partial.sectionId ?? "s1",
    difficulty: partial.difficulty ?? 2,
    active: partial.active ?? true,
    requiresManualScore: partial.requiresManualScore ?? false,
    options: partial.options ?? [],
    competencies: partial.competencies ?? [],
    items: partial.items ?? null,
    id: partial.id,
    type: partial.type,
  };
}

const resp = (
  questionId: string,
  selectedOptionIds: string[],
  extra: Partial<ResponseInput> = {},
): ResponseInput => ({ questionId, selectedOptionIds, textResponse: null, ...extra });

describe("scoreQuestion", () => {
  it("scores multiple choice: correct 100, wrong 0, unanswered 0", () => {
    const question = q({
      id: "q1",
      type: "MULTIPLE_CHOICE",
      options: [opt({ id: "a" }), opt({ id: "b", isCorrect: true })],
    });
    expect(scoreQuestion(question, resp("q1", ["b"]))).toBe(100);
    expect(scoreQuestion(question, resp("q1", ["a"]))).toBe(0);
    expect(scoreQuestion(question, undefined)).toBe(0);
  });

  it("gives partial credit for multiple select", () => {
    const question = q({
      id: "q2",
      type: "MULTIPLE_SELECT",
      options: [
        opt({ id: "a", isCorrect: true }),
        opt({ id: "b", isCorrect: true }),
        opt({ id: "c" }),
        opt({ id: "d" }),
      ],
    });
    expect(scoreQuestion(question, resp("q2", ["a", "b"]))).toBe(100);
    expect(scoreQuestion(question, resp("q2", ["a"]))).toBe(50);
    // one correct + one wrong: (1 - 0.5) / 2 = 25%
    expect(scoreQuestion(question, resp("q2", ["a", "c"]))).toBe(25);
    expect(scoreQuestion(question, resp("q2", ["c", "d"]))).toBe(0);
  });

  it("normalises likert 1..5 to 0..100", () => {
    const question = q({
      id: "q3",
      type: "LIKERT",
      options: [
        opt({ id: "l1", score: 1 }),
        opt({ id: "l2", score: 2 }),
        opt({ id: "l3", score: 3 }),
        opt({ id: "l4", score: 4 }),
        opt({ id: "l5", score: 5 }),
      ],
    });
    expect(scoreQuestion(question, resp("q3", ["l5"]))).toBe(100);
    expect(scoreQuestion(question, resp("q3", ["l4"]))).toBe(75);
    expect(scoreQuestion(question, resp("q3", ["l3"]))).toBe(50);
    expect(scoreQuestion(question, resp("q3", ["l1"]))).toBe(0);
    expect(scoreQuestion(question, undefined)).toBe(0);
  });

  it("normalises scenario options scored 0..4", () => {
    const question = q({
      id: "q4",
      type: "SCENARIO",
      options: [opt({ id: "best", score: 4 }), opt({ id: "ok", score: 2 }), opt({ id: "bad", score: 0 })],
    });
    expect(scoreQuestion(question, resp("q4", ["best"]))).toBe(100);
    expect(scoreQuestion(question, resp("q4", ["ok"]))).toBe(50);
    expect(scoreQuestion(question, resp("q4", ["bad"]))).toBe(0);
    expect(scoreQuestion(question, undefined)).toBe(0);
  });

  it("scores ordering with pairwise agreement", () => {
    const question = q({
      id: "q5",
      type: "ORDERING",
      items: [
        { id: "i1", text: "one", correctPosition: 0 },
        { id: "i2", text: "two", correctPosition: 1 },
        { id: "i3", text: "three", correctPosition: 2 },
      ],
    });
    expect(scoreQuestion(question, resp("q5", ["i1", "i2", "i3"]))).toBe(100);
    expect(scoreQuestion(question, resp("q5", ["i3", "i2", "i1"]))).toBe(0);
    // swap first two: only pair (i1,i2) wrong out of 3 -> 66.7
    expect(scoreQuestion(question, resp("q5", ["i2", "i1", "i3"]))).toBeCloseTo(66.7, 0);
  });

  it("excludes open-ended questions until rubric-scored", () => {
    const question = q({ id: "q6", type: "OPEN_ENDED", requiresManualScore: true });
    expect(scoreQuestion(question, resp("q6", [], { textResponse: "my answer" }))).toBeNull();
    expect(
      scoreQuestion(question, resp("q6", [], { textResponse: "my answer", manualScore: 3 })),
    ).toBe(75);
    expect(scoreQuestion(question, resp("q6", [], { manualScore: 0 }))).toBe(0);
  });
});

describe("runScoring", () => {
  const sections: SectionInput[] = [
    {
      id: "s1",
      code: "A",
      name: "Cognitive",
      component: "COGNITIVE",
      weight: 10,
      position: 1,
      questions: [
        q({
          id: "q1",
          sectionId: "s1",
          type: "MULTIPLE_CHOICE",
          competencies: [{ code: "LR", weight: 1 }],
          options: [opt({ id: "a", isCorrect: true }), opt({ id: "b" })],
        }),
        q({
          id: "q2",
          sectionId: "s1",
          type: "MULTIPLE_CHOICE",
          competencies: [{ code: "LR", weight: 1 }],
          options: [opt({ id: "c", isCorrect: true }), opt({ id: "d" })],
        }),
      ],
    },
    {
      id: "s2",
      code: "F",
      name: "Simulation",
      component: "SIMULATION",
      weight: 20,
      position: 2,
      questions: [
        q({
          id: "q3",
          sectionId: "s2",
          type: "SCENARIO",
          competencies: [{ code: "PS", weight: 1 }],
          options: [opt({ id: "best", score: 4 }), opt({ id: "bad", score: 0 })],
        }),
      ],
    },
    {
      id: "s3",
      code: "G",
      name: "Behaviour",
      component: "BEHAVIOUR",
      weight: 30,
      position: 3,
      questions: [
        q({
          id: "q4",
          sectionId: "s3",
          type: "LIKERT",
          competencies: [{ code: "PE", weight: 1 }],
          options: [opt({ id: "l1", score: 1 }), opt({ id: "l5", score: 5 })],
        }),
      ],
    },
    {
      id: "s4",
      code: "H",
      name: "Interest",
      component: "INTEREST",
      weight: 40,
      position: 4,
      questions: [
        q({
          id: "q5",
          sectionId: "s4",
          type: "MULTIPLE_CHOICE",
          competencies: [],
          // no correct option -> excluded from performance scoring
          options: [
            opt({ id: "i1", map: { courses: { coursex: 100, coursey: 50 } } }),
            opt({ id: "i2", map: { courses: { coursey: 100 } } }),
          ],
        }),
      ],
    },
    {
      id: "s5",
      code: "I",
      name: "Motivation",
      component: "MOTIVATION",
      weight: 50,
      position: 5,
      questions: [
        q({
          id: "q6",
          sectionId: "s5",
          type: "LIKERT",
          competencies: [{ code: "DM", weight: 1 }],
          options: [opt({ id: "m1", score: 1 }), opt({ id: "m3", score: 3 }), opt({ id: "m5", score: 5 })],
        }),
      ],
    },
  ];

  const responses: ResponseInput[] = [
    resp("q1", ["a"]), // 100
    resp("q2", ["d"]), // 0 (wrong)
    resp("q3", ["best"]), // 100
    resp("q4", ["l5"]), // 100
    resp("q5", ["i1"]), // interest -> coursex 100, coursey 50
    resp("q6", ["m3"]), // 50
  ];

  const courseX: CourseInput = {
    id: "cx",
    code: "coursex",
    name: "Course X",
    description: null,
    careerFamily: "Family",
    ctaUrl: null,
    progression: [],
    minimumScore: 65,
    weights: { LR: 5, PS: 5, PE: 5, DM: 5 },
  };
  const courseY: CourseInput = {
    ...courseX,
    id: "cy",
    code: "coursey",
    name: "Course Y",
    weights: {}, // no relevant weights -> 0
  };

  const componentWeights = {
    COGNITIVE: 40,
    SIMULATION: 30,
    BEHAVIOUR: 15,
    INTEREST: 10,
    MOTIVATION: 5,
  };

  it("aggregates competencies as weighted means", () => {
    const result = runScoring({
      sections,
      responses,
      courses: [courseX],
      settings: { componentWeights },
    });
    expect(result.competencyScores.LR).toBe(50); // (100 + 0) / 2
    expect(result.competencyScores.PS).toBe(100);
    expect(result.competencyScores.PE).toBe(100);
    expect(result.competencyScores.DM).toBe(50);
    // interest questions carry no competency mapping
    expect(result.competencyScores.NR).toBeUndefined();
  });

  it("combines component fits with configurable weights", () => {
    const result = runScoring({
      sections,
      responses,
      courses: [courseX],
      settings: { componentWeights },
    });
    // fit = 50*40 + 100*30 + 100*15 + 100*10 + 50*5 = 7750 / 100
    expect(result.courseScores.coursex).toBe(77.5);
    // overall = 50*40 + 100*30 + 100*15 + 50*5 = 6750 / 90 (interest perf excluded)
    expect(result.overallScore).toBe(75);
    expect(result.simulationScore).toBe(100);
    expect(result.completeness).toBe(1);
  });

  it("computes interest fit from option course maps", () => {
    const result = runScoring({
      sections,
      responses,
      courses: [courseX, courseY],
      settings: { componentWeights },
    });
    expect(result.courseFits.coursex.INTEREST).toBe(100);
    expect(result.courseFits.coursey.INTEREST).toBe(50);
  });

  it("scores courses with no relevant weights as 0", () => {
    const result = runScoring({
      sections,
      responses,
      courses: [courseY],
      settings: { componentWeights },
    });
    expect(result.courseScores.coursey).toBe(0);
  });

  it("counts unanswered scorable questions against completeness", () => {
    const result = runScoring({
      sections,
      responses: responses.filter((r) => r.questionId !== "q1"),
      courses: [courseX],
      settings: { componentWeights },
    });
    // 5 scorable questions (interest excluded), 4 answered
    expect(result.completeness).toBe(0.8);
    expect(result.competencyScores.LR).toBe(0); // unanswered counts 0
  });
});
