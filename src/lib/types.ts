import type { Component, QuestionType } from "@/lib/constants";

/** JSON blob stored on QuestionOption.mapJson */
export interface OptionMap {
  courses?: Record<string, number>; // courseCode -> 0..100 interest affinity
  competencies?: Record<string, number>; // competency code -> extra weight
}

export interface OptionInput {
  id: string;
  text: string;
  position: number;
  isCorrect: boolean;
  /** SCENARIO: 0..4, LIKERT: 1..5 */
  score: number;
  map: OptionMap | null;
}

export interface OrderingItem {
  id: string;
  text: string;
  correctPosition: number;
}

export interface CompetencyMapping {
  code: string;
  weight: number;
}

export interface QuestionInput {
  id: string;
  sectionId: string;
  type: QuestionType;
  difficulty: number;
  active: boolean;
  requiresManualScore: boolean;
  options: OptionInput[];
  competencies: CompetencyMapping[];
  items: OrderingItem[] | null;
}

export interface SectionInput {
  id: string;
  code: string;
  name: string;
  component: Component;
  weight: number;
  position: number;
  questions: QuestionInput[];
}

export interface ResponseInput {
  questionId: string;
  selectedOptionIds: string[];
  textResponse: string | null;
  /** 0..4 rubric score for open-ended questions once reviewed */
  manualScore?: number | null;
}

export interface CourseInput {
  id: string;
  code: string;
  name: string;
  description: string | null;
  careerFamily: string | null;
  ctaUrl: string | null;
  progression: string[];
  minimumScore: number;
  /** competency code -> 0..5 weight */
  weights: Record<string, number>;
}

export interface ScoringSettings {
  componentWeights: Record<Component, number>;
}

export interface ScoringInput {
  sections: SectionInput[];
  responses: ResponseInput[];
  courses: CourseInput[];
  settings: ScoringSettings;
}

export interface ScoringResult {
  /** questionId -> raw 0..100 (null = excluded, e.g. unscored open-ended) */
  questionScores: Record<string, number | null>;
  /** competency code -> 0..100 */
  competencyScores: Record<string, number>;
  /** component -> 0..100 performance, null when component has no scored questions */
  componentPerformance: Record<string, number | null>;
  /** sectionId -> 0..100 */
  sectionScores: Record<string, number>;
  /** courseCode -> component -> 0..100 fit (null when not applicable) */
  courseFits: Record<string, Record<string, number | null>>;
  /** courseCode -> final combined score 0..100 */
  courseScores: Record<string, number>;
  overallScore: number;
  simulationScore: number;
  /** answered / scorable questions, 0..1 */
  completeness: number;
}

export interface RecommendationSettings {
  minScore: number;
  multiPathRange: number;
  secondaryRange: number;
  confidenceHighTop: number;
  confidenceHighGap: number;
  confidenceHighPractical: number;
  confidenceModerateGap: number;
  minCompletenessHigh: number;
  minCompletenessModerate: number;
}

export interface RankedCourse {
  code: string;
  name: string;
  score: number;
  careerFamily: string | null;
  minimumScore: number;
}

export interface RecommendationResult {
  profileType: "SINGLE" | "MULTI_PATH" | "EXPLORER";
  profileFamily: string | null;
  primaryCourseCode: string | null;
  secondaryCourseCodes: string[];
  confidence: "HIGH" | "MODERATE" | "LOW";
  confidenceValue: number;
  reasons: string[];
  strengths: { name: string; score: number; label: string }[];
  interestNote: string | null;
  sharedStrengths: string[];
  explorerMessage: string | null;
}
