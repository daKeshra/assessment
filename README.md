# Africinnovate — Technology Career Aptitude Assessment

Phase 1 MVP of the Africinnovate career-orientation platform: a 65-question, config-driven
aptitude assessment that scores candidates across 16 competencies and recommends one
of 13 technology courses.

**Stack:** Next.js 15 (App Router + API routes) · Prisma ORM · SQLite (dev) /
PostgreSQL-ready (prod) · Tailwind CSS v4 · Recharts · Vitest

---

## Quick start

```powershell
# 1. Install dependencies
npm.cmd install

# 2. Configure the environment
copy .env.example .env        # SQLite by default (file:./prisma/dev.db)

# 3. Create the schema and seed all content (65 questions per assessment version, courses, users, links)
npx.cmd prisma db push
npm.cmd run db:seed

# 4. Run the dev server
npm.cmd dev
```

| URL | Purpose |
| --- | --- |
| <http://localhost:3000> | Public landing page |
| <http://localhost:3000/a/tech-aptitude-1> | Candidate assessment link (seeded) |
| <http://localhost:3000/admin> | Staff portal |
| <http://localhost:3000/admin/analytics> | Full assessment analytics |
| <http://localhost:3000/report/[token]> | Candidate report (after submission) |

### Seeded logins

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@africinnovate.com` | `Admin123!` |
| Admissions / HR | `admissions@africinnovate.com` | `Admissions123!` |
| Instructor | `instructor@africinnovate.com` | `Instructor123!` |

> The current seeded public link uses assessment version 1.1; older published versions remain available for historical attempt reproducibility.

---

## Features

### Candidate flow
- Public token link → intro/consent form → 65-question engine → instant report
- **7 question types:** multiple choice, multiple select, Likert, scenario (0–4),
  open-ended (rubric), visual (SVG stimulus), ordering
- 9 sections across 5 scoring components (Cognitive, Simulation, Behaviour,
  Interest, Motivation) with PRD weights
- Autosave every answer + localStorage queue for offline resilience; resume with
  the same email
- Timer modes: overall (default 60 min), per-section, or none — configurable
- Section randomisation + option shuffling (anti-cheat), rapid-completion and
  inactivity flags
- Idempotent submit; candidates never see correct answers, weights or competencies
- Student report: profile (Single / Multi-path / Explorer), “why this pathway”,
  strengths radar, shortlisted alternatives, learning journey, CTA (with
  privacy-conscious click tracking), disclaimer and print stylesheet

### Scoring & recommendation engines (fully config-driven)
- Pure, unit-tested functions in `src/lib/scoring.ts` and `src/lib/recommendation.ts`
- Component weights 40 / 30 / 15 / 10 / 5 (editable in Settings)
- Course fit = weighted competency scores × admin-defined 0–5 weight matrix
- Recommendation rules: minimum score, multi-path range, secondary range,
  confidence thresholds and completeness floors — all `Setting` rows, no hard-coded logic
- Open-ended answers excluded from scoring until rubric-scored by staff;
  re-scoring runs automatically after each review
- Optional AI-assisted rubric suggestions for written answers: an OpenAI-compatible
  provider returns an advisory 0–4 score and rationale, which a staff member must
  accept or replace before it affects the report
- Full staff analytics at `/admin/analytics`: date/version/course/confidence/status
  filters, completion and score trends, section/competency/difficulty performance,
  recommendation distribution, integrity flags and question watchlists

### Admin portal (RBAC: Admin, Admissions, Instructor)
- Dashboard: attempt stats, pending-review alerts, recommendation distribution
  chart, recent candidates and an entry point to full analytics
- Analytics: date/version/course/confidence/status filters, trends, score bands,
  section/competency/difficulty breakdowns, version comparison, integrity signals
  and a low-performing-question watchlist
- Candidates: filters, CSV export, detail page with radar chart, course-fit bars,
  component/section scores, integrity flags and question-by-question review
- Question bank: full CRUD inside **draft** versions (published versions are
  immutable — duplicate → edit → publish)
- Versions & links: create/duplicate/publish versions, generate/pause/close
  public links, copy URLs
- Courses (create/edit), competency **weights matrix**, competencies, and settings editors
- Audit log on every mutating action; JWT session in an httpOnly cookie (8 h)

---

## Project structure

```
prisma/
  schema.prisma          # Data model (SQLite-compatible: strings, no enums/Json)
  seed.ts                # 65 questions, 13 courses, 16 competencies, 3 users, settings
src/
  app/
    page.tsx              # Landing
    a/[token]/            # Candidate intro + registration
    assess/[token]/       # Assessment engine page
    report/[token]/       # Student report
    admin/                # Staff portal (login, dashboard, candidates, config)
    api/
      auth/               # login / logout / me
      public/             # assessment lookup + start/resume attempt
      attempts/           # engine state, autosave, submit, report
      admin/              # questions, versions, sections, weights, courses,
                          # competencies, settings, export, responses scoring
  components/
    assessment/           # AssessmentEngine, QuestionRenderer, IntroForm
    admin/                # AdminShell, QuestionForm, WeightsMatrix, SettingsForm…
    charts/               # CourseDistribution, CompetencyRadar, AnalyticsCharts
  lib/
    scoring.ts            # Pure scoring engine
    ai-scoring.ts         # Provider-agnostic advisory rubric scorer
    analytics.ts          # Pure analytics aggregation
    email.ts              # Optional transactional email adapter
    recommendation.ts     # Pure recommendation engine
    pipeline.ts           # Load → score → persist orchestration
    attempt.ts            # Whitelisted engine payload (never leaks answer keys)
    report.ts             # Student report DTO
    auth.ts / session.ts  # RBAC + JWT session
    validation.ts         # Zod schemas for every API input
tests in src/lib/__tests__/
docs/                     # API, database, deployment, admin guide
```

---

## Commands

| Command | Description |
| --- | --- |
| `npm.cmd dev` | Dev server |
| `npm.cmd run build` | Production build |
| `npm.cmd test` | Run Vitest suite (24 tests) |
| `powershell -File scripts\smoke-test.ps1` | End-to-end smoke test (40 checks; needs `npm start` on port 3001) |
| `npm.cmd run db:push` | Sync schema to the database |
| `npm.cmd run db:seed` | (Re)seed all content |
| `npm.cmd run db:studio` | Prisma Studio |
| `npm.cmd run db:reset` | Drop + recreate + reseed |

> On Windows PowerShell use `npm.cmd` / `npx.cmd` (`.ps1` scripts are blocked).

---

## Environment

`.env`:

```env
DATABASE_URL="file:./prisma/dev.db"   # dev (SQLite)
# DATABASE_URL="postgresql://user:pass@host:5432/africinnovate?schema=public"  # prod
AUTH_SECRET="change-me-to-a-long-random-string"
AI_SCORING_API_KEY=""                         # optional OpenAI-compatible key
AI_SCORING_API_URL="https://api.openai.com/v1/chat/completions"
AI_SCORING_MODEL="gpt-4o-mini"
EMAIL_PROVIDER_API_KEY=""                      # optional Resend-compatible key
EMAIL_FROM="Africinnovate <notifications@africinnovate.com>"
```

For PostgreSQL: set `provider = "postgresql"` in `prisma/schema.prisma`, run
`npx prisma db push`, then seed. See `docs/deployment.md`.

---

## Documentation

- [`docs/api.md`](docs/api.md) — endpoint reference
- [`docs/database.md`](docs/database.md) — data model & scoring fields
- [`docs/deployment.md`](docs/deployment.md) — SQLite → PostgreSQL, production hardening
- [`docs/admin-guide.md`](docs/admin-guide.md) — staff handbook

## Security notes

- Candidates are authenticated only by unguessable attempt tokens; the engine
  payload strips correct answers, option scores/maps, competency tags and weights.
- Admin routes are guarded by middleware + per-route role checks; configuration
  mutations require `ADMIN` on the server as well as in the UI.
- Rate limiting on registration, submit and report endpoints (in-memory; swap for
  Redis multi-instance).
- All config changes and content edits are written to `AuditLog`.
