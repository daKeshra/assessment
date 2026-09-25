// Shared constants. All "enums" are plain strings so the schema works on
// SQLite and PostgreSQL alike.

export const ROLES = {
  ADMIN: "ADMIN",
  ADMISSIONS: "ADMISSIONS",
  INSTRUCTOR: "INSTRUCTOR",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  ADMISSIONS: "Admissions / HR",
  INSTRUCTOR: "Instructor",
};

export const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "LIKERT",
  "SCENARIO",
  "OPEN_ENDED",
  "VISUAL",
  "ORDERING",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  MULTIPLE_SELECT: "Multiple select",
  LIKERT: "Likert scale",
  SCENARIO: "Scenario",
  OPEN_ENDED: "Open-ended",
  VISUAL: "Visual",
  ORDERING: "Ordering",
};

/** Components combine sections into the five final scoring buckets (PRD §20). */
export const COMPONENTS = {
  COGNITIVE: "COGNITIVE",
  SIMULATION: "SIMULATION",
  BEHAVIOUR: "BEHAVIOUR",
  INTEREST: "INTEREST",
  MOTIVATION: "MOTIVATION",
} as const;
export type Component = (typeof COMPONENTS)[keyof typeof COMPONENTS];

export const COMPONENT_LABELS: Record<string, string> = {
  COGNITIVE: "Cognitive Aptitude",
  SIMULATION: "Practical Simulation",
  BEHAVIOUR: "Behaviour",
  INTEREST: "Interest",
  MOTIVATION: "Motivation",
};

export const LIKERT_LABELS = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
];

export const ATTEMPT_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  TIMED_OUT: "TIMED_OUT",
  ABANDONED: "ABANDONED",
} as const;

export const VERSION_STATUS = { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", ARCHIVED: "ARCHIVED" } as const;

export const ASSESSMENT_STATUS = { ACTIVE: "ACTIVE", PAUSED: "PAUSED", CLOSED: "CLOSED" } as const;

export const PROFILE_TYPES = { SINGLE: "SINGLE", MULTI_PATH: "MULTI_PATH", EXPLORER: "EXPLORER" } as const;

export const CONFIDENCE = { HIGH: "HIGH", MODERATE: "MODERATE", LOW: "LOW" } as const;
export const CONFIDENCE_ORDER = [CONFIDENCE.LOW, CONFIDENCE.MODERATE, CONFIDENCE.HIGH];

export const TIMER_MODES = { OVERALL: "OVERALL", SECTION: "SECTION", NONE: "NONE" } as const;
export const TIMER_MODE_LABELS: Record<string, string> = {
  OVERALL: "Overall timer",
  SECTION: "Per-section timer",
  NONE: "No timer",
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Moderate",
  3: "Hard",
};

/** Setting keys (stored in the Setting table, editable by administrators). */
export const SETTING_KEYS = {
  MIN_RECOMMEND_SCORE: "min_recommend_score",
  MULTI_PATH_RANGE: "multi_path_range",
  SECONDARY_RANGE: "secondary_range",
  CONF_HIGH_TOP: "confidence_high_top",
  CONF_HIGH_GAP: "confidence_high_gap",
  CONF_HIGH_PRACTICAL: "confidence_high_practical",
  CONF_MODERATE_GAP: "confidence_moderate_gap",
  MIN_COMPLETENESS_HIGH: "min_completeness_high",
  MIN_COMPLETENESS_MODERATE: "min_completeness_moderate",
  W_COGNITIVE: "w_cognitive",
  W_SIMULATION: "w_simulation",
  W_BEHAVIOUR: "w_behaviour",
  W_INTEREST: "w_interest",
  W_MOTIVATION: "w_motivation",
  TIMER_MODE: "timer_mode",
  DURATION_MINUTES: "duration_minutes",
  ALLOW_BACK: "allow_back",
  RANDOMIZE_QUESTIONS: "randomize_questions",
  RANDOMIZE_OPTIONS: "randomize_options",
  RAPID_COMPLETION_PCT: "rapid_completion_pct",
  INACTIVITY_MINUTES: "inactivity_minutes",
} as const;

export const COMPETENCIES: { code: string; name: string; description: string }[] = [
  { code: "LR", name: "Logical Reasoning", description: "Identify rules, deduce relationships and draw valid conclusions." },
  { code: "NR", name: "Numerical Reasoning", description: "Work comfortably with numbers, percentages, ratios and data." },
  { code: "PR", name: "Pattern Recognition", description: "Spot regularities, sequences and anomalies." },
  { code: "AD", name: "Attention to Detail", description: "Notice small errors, inconsistencies and precision issues." },
  { code: "PS", name: "Problem Solving", description: "Break problems down and work towards workable solutions." },
  { code: "ST", name: "Systems Thinking", description: "See how parts of a system interact and affect each other." },
  { code: "PT", name: "Process Thinking", description: "Understand ordering, dependencies and workflows." },
  { code: "VR", name: "Visual Reasoning", description: "Interpret layout, hierarchy and visual information." },
  { code: "CR", name: "Creativity", description: "Generate original ideas and approaches." },
  { code: "CM", name: "Communication", description: "Express ideas clearly for different audiences." },
  { code: "EM", name: "Empathy / User Understanding", description: "Consider other people's perspective and needs." },
  { code: "IN", name: "Investigation", description: "Search for evidence and dig into unclear situations." },
  { code: "AB", name: "Abstract Thinking", description: "Reason about unfamiliar concepts and symbols." },
  { code: "PE", name: "Persistence", description: "Keep going when work is difficult or slow." },
  { code: "EX", name: "Experimentation / Curiosity", description: "Try things out and ask why." },
  { code: "DM", name: "Decision Making", description: "Choose effectively under uncertainty." },
];

export const COMPETENCY_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  COMPETENCIES.map((c) => [c.code, c.name]),
);

export const PROFILE_LABELS: Record<string, string> = {
  SINGLE: "Recommended Pathway",
  MULTI_PATH: "Multi-Path Technology Profile",
  EXPLORER: "Technology Explorer",
};

export const EDUCATION_LEVELS = [
  "Secondary school graduate",
  "Undergraduate",
  "Graduate",
  "Postgraduate",
  "Career switcher / self-taught",
  "Other",
];

export const OCCUPATIONS = [
  "Student",
  "Corper (NYSC)",
  "Employed - non-technical",
  "Employed - technical",
  "Self-employed / business owner",
  "Job seeking",
  "Other",
];

export const AGE_RANGES = ["Under 18", "18-24", "25-34", "35-44", "45+"];

export const TECH_EXPOSURE = [
  "None at all",
  "A little (social media, office tools)",
  "Some (I have tried a tool or tutorial)",
  "Considerable (I have built something small)",
];

export const HOURS_PER_WEEK = ["Under 5 hours", "5-10 hours", "10-20 hours", "20+ hours"];

export const LEARNING_FORMATS = ["Live classes", "Recorded videos", "Self-paced reading", "No preference"];

export const DISCLAIMER =
  "This assessment provides an aptitude-based learning recommendation. It does not determine your ability or guarantee success in a particular career. Your interests, effort, learning environment and experience also matter.";

/** Section code → career relevance notes used in admin UI copy. */
export const FALLBACK_DISCLAIMER = DISCLAIMER;
