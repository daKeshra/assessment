import { describe, expect, it } from "vitest";
import { buildRecommendation } from "@/lib/recommendation";
import { COMPONENTS } from "@/lib/constants";
import type { CourseInput, RecommendationSettings, ScoringResult } from "@/lib/types";

const settings: RecommendationSettings = {
  minScore: 65,
  multiPathRange: 5,
  secondaryRange: 5,
  confidenceHighTop: 80,
  confidenceHighGap: 7,
  confidenceHighPractical: 70,
  confidenceModerateGap: 3,
  minCompletenessHigh: 0.9,
  minCompletenessModerate: 0.8,
};

function course(code: string, family = "Family"): CourseInput {
  return {
    id: code,
    code,
    name: code.toUpperCase(),
    description: null,
    careerFamily: family,
    ctaUrl: null,
    progression: [],
    minimumScore: 65,
    weights: { LR: 5 },
  };
}

function scoring(partial: Partial<ScoringResult>): ScoringResult {
  return {
    questionScores: {},
    competencyScores: { LR: 85, PS: 80 },
    componentPerformance: {},
    sectionScores: {},
    courseFits: {},
    courseScores: {},
    overallScore: 80,
    simulationScore: 80,
    completeness: 1,
    ...partial,
  };
}

function withFits(s: ScoringResult, interestByCourse: Record<string, number>): ScoringResult {
  const courseFits: Record<string, Record<string, number | null>> = {};
  for (const [code, value] of Object.entries(interestByCourse)) {
    courseFits[code] = { [COMPONENTS.INTEREST]: value };
  }
  return { ...s, courseFits };
}

describe("buildRecommendation", () => {
  it("returns a single primary with secondaries inside the range (PRD §21 example)", () => {
    const s = withFits(
      scoring({
        courseScores: { data_analysis: 91, data_science: 88, backend_development: 70 },
      }),
      { data_analysis: 40, data_science: 30, backend_development: 10 },
    );
    const rec = buildRecommendation({
      courses: [course("data_analysis"), course("data_science"), course("backend_development")],
      scoring: s,
      settings,
    });
    expect(rec.profileType).toBe("SINGLE");
    expect(rec.primaryCourseCode).toBe("data_analysis");
    // only the course within secondaryRange of the top score qualifies
    expect(rec.secondaryCourseCodes).toEqual(["data_science"]);
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("returns High confidence when top, gap, practical and completeness are strong", () => {
    const s = scoring({
      courseScores: { backend_development: 92, cybersecurity: 82, data_analysis: 60 },
      simulationScore: 85,
      completeness: 1,
    });
    const rec = buildRecommendation({
      courses: [course("backend_development"), course("cybersecurity"), course("data_analysis")],
      scoring: s,
      settings,
    });
    expect(rec.confidence).toBe("HIGH");
    expect(rec.primaryCourseCode).toBe("backend_development");
  });

  it("caps High to Moderate when practical simulation performance is weak", () => {
    const s = scoring({
      courseScores: { backend_development: 92, cybersecurity: 82 },
      simulationScore: 50,
    });
    const rec = buildRecommendation({
      courses: [course("backend_development"), course("cybersecurity")],
      scoring: s,
      settings,
    });
    expect(rec.confidence).toBe("MODERATE");
  });

  it("detects a Multi-Path profile when the top three cluster (PRD §22)", () => {
    const s = scoring({
      courseScores: { backend_development: 86, cybersecurity: 84, ai_workflow_automation: 83 },
    });
    const rec = buildRecommendation({
      courses: [
        course("backend_development"),
        course("cybersecurity"),
        course("ai_workflow_automation"),
      ],
      scoring: s,
      settings,
    });
    expect(rec.profileType).toBe("MULTI_PATH");
    expect(rec.primaryCourseCode).toBe("backend_development");
    expect(rec.secondaryCourseCodes).toEqual(["cybersecurity", "ai_workflow_automation"]);
    expect(rec.confidence).toBe("MODERATE");
    expect(rec.sharedStrengths.length).toBeGreaterThan(0);
  });

  it("returns Technology Explorer when no course reaches the threshold (PRD §23)", () => {
    const s = scoring({
      courseScores: { frontend_development: 58, product_design: 55, data_analysis: 50 },
      competencyScores: { LR: 55 },
    });
    const rec = buildRecommendation({
      courses: [course("frontend_development"), course("product_design"), course("data_analysis")],
      scoring: s,
      settings,
    });
    expect(rec.profileType).toBe("EXPLORER");
    expect(rec.primaryCourseCode).toBeNull();
    expect(rec.explorerMessage).toContain("foundational digital technology program");
    expect(rec.confidence).not.toBe("HIGH");
  });

  it("uses each course's editable minimum threshold", () => {
    const strictCourse = { ...course("backend_development"), minimumScore: 80 };
    const rec = buildRecommendation({
      courses: [strictCourse],
      scoring: scoring({ courseScores: { backend_development: 70 } }),
      settings,
    });
    expect(rec.profileType).toBe("EXPLORER");
    expect(rec.primaryCourseCode).toBeNull();
  });

  it("caps confidence for low completeness", () => {
    const s = scoring({
      courseScores: { backend_development: 92, cybersecurity: 80 },
      completeness: 0.5,
    });
    const rec = buildRecommendation({
      courses: [course("backend_development"), course("cybersecurity")],
      scoring: s,
      settings,
    });
    expect(rec.confidence).toBe("LOW");
    expect(rec.reasons.some((r) => r.includes("unanswered"))).toBe(true);
  });

  it("flags interest-aptitude mismatch without overriding aptitude (PRD §50)", () => {
    const s = withFits(
      scoring({
        courseScores: { backend_development: 88, ui_ux_design: 55, cybersecurity: 70 },
      }),
      { ui_ux_design: 100, backend_development: 20 },
    );
    const rec = buildRecommendation({
      courses: [course("backend_development"), course("ui_ux_design"), course("cybersecurity")],
      scoring: s,
      settings,
    });
    expect(rec.primaryCourseCode).toBe("backend_development");
    expect(rec.interestNote).toBeTruthy();
    expect(rec.interestNote).toContain("UI_UX_DESIGN");
  });
});
