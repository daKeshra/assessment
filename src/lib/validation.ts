import { z } from "zod";
import {
  AGE_RANGES,
  EDUCATION_LEVELS,
  HOURS_PER_WEEK,
  LEARNING_FORMATS,
  OCCUPATIONS,
  TECH_EXPOSURE,
} from "@/lib/constants";

const oneOf = (list: string[]) => z.enum(list as [string, ...string[]]);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(25)
    .regex(/^[0-9+\-\s()]+$/, "Phone number can only contain digits and + - ( )"),
  educationLevel: oneOf(EDUCATION_LEVELS),
  occupation: oneOf(OCCUPATIONS),
  ageRange: z.string().max(40).optional().or(z.literal("")),
  techExposure: z.string().max(60).optional().or(z.literal("")),
  hoursPerWeek: z.string().max(40).optional().or(z.literal("")),
  preferredFormat: z.string().max(40).optional().or(z.literal("")),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must accept the consent statement to continue" }),
  }),
});

export const resumeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const responseSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string()).max(50).default([]),
  textResponse: z.string().max(4000).optional().nullable(),
  timeSpentMs: z.number().int().min(0).max(3_600_000).default(0),
  currentQuestionId: z.string().optional(),
  sectionId: z.string().optional(),
  sectionView: z.boolean().optional(),
});

export const submitSchema = z.object({
  timedOut: z.boolean().optional().default(false),
});

export const questionOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1).max(500),
  position: z.number().int().min(0).max(50),
  isCorrect: z.boolean().default(false),
  score: z.number().int().min(0).max(5).default(0),
  mapJson: z.string().nullable().optional(),
});

export const questionSchema = z.object({
  sectionId: z.string().min(1),
  type: z.enum([
    "MULTIPLE_CHOICE",
    "MULTIPLE_SELECT",
    "LIKERT",
    "SCENARIO",
    "OPEN_ENDED",
    "VISUAL",
    "ORDERING",
  ]),
  prompt: z.string().trim().min(2, "Prompt is required").max(4000),
  stimulus: z.string().max(4000).nullable().optional(),
  stimulusSvg: z.string().max(20000).nullable().optional(),
  difficulty: z.number().int().min(1).max(3),
  active: z.boolean(),
  position: z.number().int().min(0).max(500),
  items: z.array(z.object({ text: z.string().trim().min(1).max(300) })).min(2).max(20).optional(),
  // OPEN_ENDED / ORDERING legitimately have no options; per-type answer
  // rules are enforced by validateAnswers() after parsing.
  options: z.array(questionOptionSchema).min(0).max(10),
  competencies: z
    .array(z.object({ code: z.string().min(1), weight: z.number().min(0.25).max(5) }))
    .max(16),
});

export const settingsPatchSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export const weightsSchema = z.object({
  weights: z.record(z.string(), z.record(z.string(), z.number().int().min(0).max(5))),
});

export const competencySchema = z.object({
  code: z.string().trim().min(1).max(10),
  name: z.string().trim().min(2).max(80),
  description: z.string().max(300).nullable().optional(),
  active: z.boolean(),
});

export const courseSchema = z.object({
  courseName: z.string().trim().min(2).max(80),
  description: z.string().max(1000).nullable().optional(),
  careerFamily: z.string().max(80).nullable().optional(),
  ctaUrl: z.string().max(300).nullable().optional(),
  progression: z.array(z.string().max(120)).max(10).optional(),
  minimumScore: z.number().min(0).max(100),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(999),
});

export const courseCreateSchema = courseSchema.extend({
  courseCode: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{2,80}$/, "Use lowercase letters, numbers and underscores"),
});

export const humanScoreSchema = z.object({
  humanScore: z.number().int().min(0).max(4),
});

export const versionSchema = z.object({
  versionName: z.string().trim().min(2).max(120),
  versionNumber: z.string().trim().min(1).max(20),
  notes: z.string().max(500).optional(),
});

export const sectionSchema = z.object({
  assessmentVersionId: z.string().min(1),
  code: z.string().trim().min(1).max(5),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  component: z.enum(["COGNITIVE", "SIMULATION", "BEHAVIOUR", "INTEREST", "MOTIVATION"]),
  weight: z.number().min(0).max(100),
  position: z.number().int().min(0).max(99),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
