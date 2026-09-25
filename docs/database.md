# Database & Data Model

Prisma schema: `prisma/schema.prisma`.

**Design rule:** plain strings instead of Prisma `enum` and `String` columns
instead of `Json`, so the identical schema works on **SQLite** (development) and
**PostgreSQL** (production). JSON payloads are serialized by the application and
parsed with safe fallbacks (`src/lib/pipeline.ts`, `src/lib/attempt.ts`).

Switching providers is only: change `datasource.db.provider` + `DATABASE_URL`,
run `prisma db push`, seed.

---

## Entity map

```
User ─┐                          Setting (config key/value)
      ├─ AuditLog
Competency ─ QuestionCompetency ─ Question ─ QuestionOption
     │              │               │
     │              │            Response ─ ResponseScore (rubric/manual)
Course ─ CourseCompetencyWeight     │
     │                              │
     └──────── AssessmentReport ────┤
                Recommendation ─────┤
                CompetencyScore ────┤
                CourseScore ────────┤
                                    │
AssessmentVersion ─ Section ────────┤
        │                           │
        └── Assessment ─── Attempt ─┘
                    Candidate ──────┘
```

## Tables

### Identity & config
| Table | Purpose | Notes |
| --- | --- | --- |
| `User` | Staff accounts | `role`: ADMIN / ADMISSIONS / INSTRUCTOR, bcrypt `passwordHash`, `active` |
| `AuditLog` | Immutable activity trail | `action`, `entity`, `entityId`, `metaJson`, `ipAddress` |
| `Setting` | **All tunable configuration** | `key` PK, `value` (string), `group`, `label`, `type` (number/boolean/select/string), `options` |

### Versioned content (immutable once published)
| Table | Purpose | Notes |
| --- | --- | --- |
| `AssessmentVersion` | Version container | `status`: DRAFT → PUBLISHED → ARCHIVED; `versionNumber` unique-ish ("1.0") |
| `Section` | 9 sections A–I | `component` (COGNITIVE/SIMULATION/BEHAVIOUR/INTEREST/MOTIVATION), `weight` within component, `position` |
| `Question` | 73 seeded questions | `type` (7 types), `prompt`, `stimulus`, `stimulusSvg`, `difficulty` 1–3, `active`, `itemsJson` (ordering key), `requiresManualScore` (open-ended) |
| `QuestionOption` | Answer options | `isCorrect`, `score` (SCENARIO 0–4, LIKERT 1–5), `mapJson` = `{courses:{code:0..100}, competencies:{code:weight}}` |
| `Competency` | 16 competencies | `code` (LR, NR, …) unique |
| `QuestionCompetency` | Question → competency tag | `weight` 0.25–5; unique per pair |
| `Assessment` | **Public link** | `token` = URL slug (`/a/[token]`), `status`: ACTIVE/PAUSED/CLOSED, points at a version |
| `Course` | 13 pathways | `courseCode` unique, `minimumScore` (default 65), `ctaUrl`, `progressionJson`, `displayOrder`, `active` |
| `CourseCompetencyWeight` | **Weight matrix cell** | `weight` 0–5 (PRD §19), unique (course, competency) |

### Runtime (candidate attempts)
| Table | Purpose | Notes |
| --- | --- | --- |
| `Candidate` | Registration data | education, occupation, age, exposure, hours, format |
| `Attempt` | One sit of the assessment | `token` (resume/report key, 18 random bytes), status IN_PROGRESS → SUBMITTED / TIMED_OUT / ABANDONED, timing, `questionOrderJson` / `optionOrderJson` / `itemOrderJson` randomisation snapshots, `sectionStartsJson`, `flagsJson`, IP/user agent. Unique (candidate, assessment) |
| `Response` | One saved answer | `selectedOptionIds` (JSON array; order = ordering answer), `textResponse`, `timeSpentMs`. Unique (attempt, question) |
| `ResponseScore` | Score for one response | `rawScore` 0–100, optional advisory `aiScore`/`aiRationale`/`aiConfidence`/`aiModel`, human `humanScore` 0–4 (nullable), `finalScore` 0–100, `reviewedById/At`. AI metadata never bypasses human review. |
| `CompetencyScore` | Attempt × competency | 0–100 |
| `CourseScore` | Attempt × course | `score` 0–100, `rank`, `fitJson` per-component fits |
| `Recommendation` | Final recommendation | `primaryCourseId`, `secondaryCourseIds` (JSON), `profileType` SINGLE/MULTI_PATH/EXPLORER, `confidence` HIGH/MODERATE/LOW + `confidenceValue`, `explanationJson` (reasons, strengths, interestNote, explorerMessage) |
| `AssessmentReport` | Snapshot result | `overallScore`, `completeness` 0–1, `simulationScore`, `componentScoresJson`, `sectionScoresJson` |
| `AssessmentEvent` | Product analytics events | `CTA_CLICKED`, `RECOMMENDATION_ACCEPTED`, future `ENROLLED`/`COMPLETED`; optional attempt/course links and metadata |

---

## Setting keys (seeded defaults)

| Group | Key | Default | Meaning |
| --- | --- | --- | --- |
| thresholds | `min_recommend_score` | 65 | Global fallback threshold; each course can override it with `Course.minimumScore` |
| thresholds | `multi_path_range` | 5 | Max point spread across top 3 → MULTI_PATH |
| thresholds | `secondary_range` | 5 | Max gap to list a secondary pathway |
| thresholds | `confidence_high_top` / `_gap` / `_practical` | 80 / 7 / 70 | HIGH confidence conditions (PRD §24) |
| thresholds | `confidence_moderate_gap` | 3 | MODERATE condition |
| thresholds | `min_completeness_high` / `_moderate` | 0.9 / 0.8 | Completeness floors |
| scoring | `w_cognitive` … `w_motivation` | 40/30/15/10/5 | Component weights (must total 100) |
| assessment | `timer_mode` | OVERALL | OVERALL / SECTION / NONE |
| assessment | `duration_minutes` | 60 | Total time budget |
| assessment | `allow_back` | true | Candidate may revisit previous questions |
| anti-cheat | `randomize_questions` / `randomize_options` | true | Shuffle per attempt |
| anti-cheat | `rapid_completion_pct` | 0.25 | Flag if duration < 25% of allowed time |
| anti-cheat | `inactivity_minutes` | 20 | Flag long inactivity near the end |

---

## Score pipeline (what gets written on submit)

```
runScoring()                          buildRecommendation()
  questionScores  (0–100, null=unscored)   profileType / profileFamily
  competencyScores (per 16)                primary + secondary courses
  componentPerformance (per 5)             confidence + confidenceValue
  sectionScores (per 9)                    reasons / strengths / interestNote
  courseFits + courseScores (ranked)       explorerMessage
  overallScore (40/30/15/10/5)        │
  simulationScore, completeness       │
                └──────────┬───────────┘
                           ▼
   CompetencyScore, CourseScore, Recommendation,
   AssessmentReport, ResponseScore (raw/final)  — persisted in one transaction
```

Re-running is safe: derived tables are `deleteMany` + recreated for the attempt.
Triggered by submit, rubric scoring, and lazily by the report endpoint when
results are missing.

---

## Migrations & seeding

```powershell
npx.cmd prisma validate        # schema check
npx.cmd prisma migrate dev     # create/apply development migrations
npx.cmd prisma db push         # quick local sync when you do not need migration history
npm.cmd run db:seed            # idempotent-ish full seed (settings, competencies,
                               # courses + weights, 3 users, 9 sections, 73 questions,
                               # published version 1.2, link tech-aptitude-1)
npx.cmd prisma studio          # browse data
```

Seed source of truth: `prisma/seed.ts` (all 73 questions with options, maps,
competency tags, SVG stimuli and ordering keys inline).
