# API Reference

All responses are JSON unless noted. Errors use:

```json
{ "error": "Human readable message", "code": "OPTIONAL_CODE" }
```

Zod failures return `400` with `issues: [{ path, message }]`.
Admin endpoints require the `africinnovate_session` cookie (see Authentication).

---

## Authentication

| Method | Endpoint | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` | Sets httpOnly session cookie (8 h) |
| POST | `/api/auth/logout` | — | Clears the cookie |
| GET | `/api/auth/me` | — | Current session or `401` |

**Roles:** `ADMIN` (everything), `ADMISSIONS` (candidates + export), `INSTRUCTOR`
(candidates + rubric scoring). Enforced by `middleware.ts` on `/admin*` and
`/api/admin*`, and again per route with `requireSession(roles?)`.

---

## Public — assessment & attempts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/public/assessments/[token]` | Resolve a public link: title, version status, section/ question counts, timer settings. `404` unknown/inactive link. |
| POST | `/api/public/assessments/[token]/attempts` | Register/resume. Body = `registerSchema` (name, email, phone, education, occupation, consent…). Returns `{ attemptToken, resumed, status }`. Same email + link ⇒ resume (rate-limited 8/min/IP). |
| GET | `/api/attempts/[token]` | **Engine payload** — whitelisted questions (no answers/maps/tags), section order, per-question randomised order, config, saved responses, remaining time. Completed attempts return `{ completed, reportUrl }`. |
| POST | `/api/attempts/[token]/responses` | Autosave one answer `{ questionId, selectedOptionIds, textResponse?, timeSpentMs?, currentQuestionId?, sectionId?, sectionView? }`. Also records section starts for SECTION timer mode and activity for anti-cheat. |
| POST | `/api/attempts/[token]/submit` | Body `{ timedOut?: boolean }`. Idempotent — a second call returns `{ alreadySubmitted, reportUrl }`. Computes duration, integrity flags (`rapidCompletion`, `inactiveNearEnd`, `autoSubmitted`), runs the scoring pipeline. Returns `{ ok, reportUrl, timedOut }`. Rate-limited 5/min/attempt. |
| GET | `/api/attempts/[token]/report` | Student report DTO (shape in `src/lib/report.ts`). `409 NOT_COMPLETED` until submitted/timed out. Rate-limited 30/min/IP. |
| POST | `/api/public/analytics/events` | Records a privacy-conscious `CTA_CLICKED` event when a candidate follows the recommended-course CTA. No authentication; the unguessable attempt token is required. |

### Timing rules
- `OVERALL` mode: remaining = `duration_minutes` − elapsed since `startTime`.
- `SECTION` mode: total duration split evenly across sections; starts recorded in
  `Attempt.sectionStartsJson`.
- `NONE`: no server-side expiry; manual submit only.

---

## Admin

> `401` without session · `403` without role · published versions return
> `409 VERSION_IMMUTABLE` on content mutations.

### Questions & content

| Method | Endpoint | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/questions` | any | Filters: `q, type, active, sectionId, versionId` |
| POST | `/api/admin/questions` | ADMIN | `questionSchema`; draft sections only; validates answer key per type |
| GET | `/api/admin/questions/[id]` | any | Question with options + competency tags |
| PATCH | `/api/admin/questions/[id]` | ADMIN | Full replace of options/competencies (draft only) |
| DELETE | `/api/admin/questions/[id]` | ADMIN | Draft only; cascades options/tags |
| GET | `/api/admin/sections?versionId=...` | any | List sections and question counts for a version |
| POST | `/api/admin/sections` | ADMIN | `sectionSchema` into a draft version |
| PATCH | `/api/admin/sections/[id]` | ADMIN | name/description/weight/position/component |
| DELETE | `/api/admin/sections/[id]` | ADMIN | Only when the section has no questions |

### Versions & links

| Method | Endpoint | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/versions` | any | Versions with section/question/attempt counts |
| POST | `/api/admin/versions` | ADMIN | `{ versionName, versionNumber, notes? }` → creates DRAFT |
| POST | `/api/admin/versions/[id]/duplicate` | ADMIN | Deep copy (sections, questions, options, tags) into a new DRAFT with bumped version number |
| POST | `/api/admin/versions/[id]/publish` | ADMIN | Validates ≥1 section and no empty sections; sets `PUBLISHED` + `publishedAt` |
| GET | `/api/admin/assessments` | any | All public links with attempt counts |
| POST | `/api/admin/assessments` | ADMIN | `{ assessmentVersionId, title, slug? }` — published versions only; `slug` = custom token `[a-z0-9-]{3,40}` |
| PATCH | `/api/admin/assessments/[token]` | ADMIN | `{ status: ACTIVE \| PAUSED \| CLOSED }` |

### Configuration

| Method | Endpoint | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/settings` | any | All `Setting` rows |
| PATCH | `/api/admin/settings` | ADMIN | `{ [key]: value }`; values validated against declared type and ranges |
| GET | `/api/admin/weights` | any | Courses with their competency weights |
| PUT | `/api/admin/weights` | ADMIN | `{ weights: { [courseId]: { [competencyId]: 0..5 } } }` — bulk upsert |
| GET | `/api/admin/competencies` | any | With question/course usage counts |
| POST | `/api/admin/competencies` | ADMIN | `{ code, name, description?, active }`; code upper-cased, unique |
| PATCH | `/api/admin/competencies/[id]` | ADMIN | `{ name?, description?, active? }` (code immutable) |
| GET | `/api/admin/courses` | any | List courses and competency-weight counts |
| POST | `/api/admin/courses` | ADMIN | Create a course pathway with a unique `courseCode`; weights can be configured after creation |
| PATCH | `/api/admin/courses/[id]` | ADMIN | `courseSchema.partial()` — name, description, family, CTA, progression steps, min score, order, active |

### Candidates & export

| Method | Endpoint | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/export` | ADMIN, ADMISSIONS | **CSV download** (UTF-8 BOM). Filters: `from, to, status, version, course, confidence`. Columns: identity, dates, version, status, duration, overall, completeness, primary/secondary recommendation, profile, confidence, all 16 competencies, all 13 course scores. Max 5 000 rows. |
| PATCH | `/api/admin/responses/[id]/score` | ADMIN, INSTRUCTOR | `{ humanScore: 0..4 }` for open-ended responses. Stores `finalScore = humanScore/4×100`, records reviewer + timestamp, **re-runs the scoring pipeline** so the report stays in sync, writes an audit entry. |
| POST | `/api/admin/responses/[id]/ai-score` | ADMIN, INSTRUCTOR | Generates an advisory rubric suggestion through the configured OpenAI-compatible provider. Stores `aiScore`, rationale, confidence and model metadata; it does **not** affect the report until a staff member calls the human-score endpoint. |
| GET | `/api/admin/analytics` | any staff | Aggregated, non-identifying analytics JSON. Optional filters: `from`, `to`, `version`, `course`, `confidence`, `status`. |

### Audit

Every mutating admin endpoint writes an `AuditLog` row:
`{ userId, action, entity, entityId, metaJson, ipAddress, createdAt }`
(actions: `LOGIN`, `QUESTION_CREATED/UPDATED/DELETED`, `SECTION_*`,
`VERSION_CREATED/DUPLICATED/PUBLISHED`, `ASSESSMENT_LINK_CREATED/UPDATED`,
`SETTINGS_UPDATED`, `WEIGHTS_UPDATED`, `COURSE_CREATED/UPDATED`,
`COMPETENCY_CREATED/UPDATED`, `RESPONSE_SCORED`, `RESPONSE_AI_SCORED`, `ATTEMPT_SUBMITTED`).

---

## Scoring pipeline

`scoreAndStoreAttempt(attemptId)` (used by submit + rubric save + report):

1. Load sections/questions/options/tags, responses (+ existing manual scores),
   active courses + weight matrix, settings.
2. `runScoring()` → per-question raw scores, competency scores, component
   performance, section scores, course fits, overall, simulation, completeness.
3. `buildRecommendation()` → profile type/family, primary + secondary courses,
   confidence, rationale.
4. Persist atomically: `CompetencyScore`, `CourseScore` (rank + fits),
   `Recommendation`, `AssessmentReport`, `ResponseScore` rows.

Open-ended questions with no `humanScore` return `null` raw score and are
excluded from completeness denominators until reviewed. An AI suggestion may be
stored alongside the response for staff review, but it never changes this
pipeline automatically.

---

## Analytics

`GET /api/admin/analytics` returns a privacy-safe aggregate summary for the
staff analytics dashboard. It includes completion and volume trends, score
bands, section/component/competency averages, question difficulty performance,
recommendation/profile/confidence distributions, version comparisons, integrity
flags, pending AI reviews and a lowest-performing-question watchlist. Candidate
identities and written answers are not returned.
