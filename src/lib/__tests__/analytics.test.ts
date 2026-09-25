import { describe, expect, it } from "vitest";
import { buildAnalytics, type AnalyticsAttempt } from "@/lib/analytics";

const sections = [
  { id: "s1", code: "A", name: "Reasoning" },
  { id: "s2", code: "B", name: "Simulation" },
];

function attempt(overrides: Partial<AnalyticsAttempt> = {}): AnalyticsAttempt {
  return {
    id: "attempt-1",
    status: "SUBMITTED",
    startTime: new Date("2026-01-01T10:00:00.000Z"),
    lastActivityAt: new Date("2026-01-01T10:30:00.000Z"),
    submissionTime: new Date("2026-01-01T10:30:00.000Z"),
    durationSeconds: 1800,
    flagsJson: JSON.stringify({ rapidCompletion: true }),
    versionName: "Assessment",
    versionNumber: "1.0",
    report: {
      overallScore: 82,
      completeness: 1,
      simulationScore: 76,
      componentScoresJson: JSON.stringify({ COGNITIVE: 84 }),
      sectionScoresJson: JSON.stringify({ s1: 82, s2: 76 }),
    },
    recommendation: {
      profileType: "SINGLE",
      confidence: "HIGH",
      primaryCourse: {
        courseName: "Backend Development",
        careerFamily: "Technology Systems & Engineering",
      },
    },
    competencyScores: [
      { score: 84, competency: { code: "LR", name: "Logical Reasoning" } },
    ],
    events: [{ type: "CTA_CLICKED" }],
    responses: [
      {
        textResponse: "A structured response",
        question: {
          id: "q1",
          prompt: "Explain your approach",
          difficulty: 2,
          requiresManualScore: true,
          section: sections[0],
        },
        score: { finalScore: 75, aiScore: 3, humanScore: null },
      },
      {
        textResponse: null,
        question: {
          id: "q2",
          prompt: "Choose one",
          difficulty: 1,
          requiresManualScore: false,
          section: sections[1],
        },
        score: { finalScore: 90, aiScore: null, humanScore: null },
      },
    ],
    ...overrides,
  };
}

describe("buildAnalytics", () => {
  it("aggregates completion, performance, distributions and review queue", () => {
    const summary = buildAnalytics(
      [
        attempt(),
        attempt({
          id: "attempt-2",
          status: "IN_PROGRESS",
          report: null,
          recommendation: null,
          competencyScores: [],
          events: [],
          responses: [],
          flagsJson: null,
        }),
      ],
      sections,
    );

    expect(summary.totalAttempts).toBe(2);
    expect(summary.completedAttempts).toBe(1);
    expect(summary.completionRate).toBe(0.5);
    expect(summary.averageScore).toBe(82);
    expect(summary.recommendationDistribution[0]).toEqual({
      name: "Backend Development",
      count: 1,
    });
    expect(summary.careerFamilyDistribution[0].name).toBe(
      "Technology Systems & Engineering",
    );
    expect(summary.sectionAverages.find((row) => row.code === "A")?.average).toBe(82);
    expect(summary.difficultyAverages.find((row) => row.difficulty === 2)?.average).toBe(75);
    expect(summary.pendingAiReview).toBe(1);
    expect(summary.ctaClicks).toBe(1);
    expect(summary.recommendationAcceptanceRate).toBe(1);
    expect(summary.integrityFlags).toContainEqual({ name: "rapidCompletion", count: 1 });
  });

  it("ignores malformed report JSON without losing other metrics", () => {
    const summary = buildAnalytics(
      [
        attempt({
          report: {
            overallScore: 70,
            completeness: 0.8,
            simulationScore: null,
            componentScoresJson: "not-json",
            sectionScoresJson: null,
          },
          responses: [],
        }),
      ],
      sections,
    );

    expect(summary.averageScore).toBe(70);
    expect(summary.componentAverages).toEqual([]);
    expect(summary.sectionAverages.every((row) => row.average === null)).toBe(true);
  });
});
