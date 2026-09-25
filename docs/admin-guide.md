# Admin Guide — Africinnovate Assessment Portal

For staff: **Administrator**, **Admissions / HR**, **Instructor**.
Sign in at `/admin` (you'll be redirected there from any admin page if not logged in).

---

## 1. Roles & permissions

| Area | Administrator | Admissions | Instructor |
| --- | --- | --- | --- |
| Dashboard | ✅ | ✅ | ✅ |
| Candidates list & detail | ✅ | ✅ | ✅ |
| CSV export | ✅ | ✅ | ❌ |
| Rubric-score open-ended answers | ✅ | ❌ | ✅ |
| Questions / versions / links | ✅ | ❌ | ❌ |
| Courses / weights / competencies / settings | ✅ | ❌ | ❌ |

Sessions last **8 hours**; sign out from the header. Non-admins simply don't see
admin-only navigation, and the API rejects them with `403` anyway.

---

## 2. Dashboard

- **Stat cards:** total attempts, completed (with completion rate), average score,
  open-ended answers awaiting review.
- **Alert banner** appears while responses need rubric scoring — reports for those
  candidates are incomplete until scored.
- **Chart:** distribution of primary recommendations across all scored attempts.
- **Recent candidates:** click any row to open the detail page.

---

## 3. Sharing the assessment

1. Go to **Versions & Links**.
2. **Generate public link** → pick a published version, add a title, optionally a
   custom slug (e.g. `spring-2026`) → **Create link**.
3. **Copy link** and send it to candidates: `https://<site>/a/<slug>`.
4. Controls per link:
   - **Activate / Pause** — paused links block new attempts; the admin page
     confirms the new status immediately.
   - **Close** — asks for confirmation and blocks the public link; use
     **Reopen** on the link row to make it active again.
   - **Open** — preview the candidate experience in a new tab.

---

## 3a. Analytics

Open **Analytics** in the staff navigation for the full assessment view. Filter
by date range, assessment version, recommended course, confidence or attempt
status. The view covers:

- started/completed volume over time;
- completion rate, average score, completeness and duration;
- score bands and section/competency/difficulty performance;
- career-family, course, profile and confidence distributions;
- version comparison, integrity flags and low-performing questions;
- open-ended responses waiting for AI suggestions or human confirmation.

The analytics API is available at `GET /api/admin/analytics` for approved staff
and BI tooling. It returns aggregates only, not candidate identities or answer text.

### AI-assisted written-answer scoring

On a candidate detail page, use **Suggest score with AI** for an open-ended
response. Configure `AI_SCORING_API_KEY` and an OpenAI-compatible endpoint in
`.env` first. The result is advisory: it stores the model score, rationale,
confidence and model name, but does not change the candidate report. A staff
member must click **Accept as human score** or choose a rubric score manually.

---

## 4. Content: versions, sections, questions

### The immutability rule (important)
Once a version is **PUBLISHED** it can never be edited — candidates who already
started must see identical content. To change anything:

> **Duplicate** (creates a new DRAFT with a bumped version number) → edit →
> **Publish** → create a link for the new version.

Attempts keep pointing at the version they started with, so historical reports
stay reproducible.

### Editing questions
1. **Questions** → filter by version/type/status.
2. Click **Edit** (draft questions only) or **New question**.
3. Form sections:
   - **Setup** — section, type, prompt, optional text stimulus, optional SVG
     stimulus (visual questions), difficulty, position, active flag.
   - **Answer options** — ✔ marks the correct choice (choice/multi-select/visual);
     scenario/likert use the score column; the `map` field is optional JSON for
     interest affinity, e.g. `{"courses":{"data_analysis":90},"competencies":{"NR":2}}`.
   - **Ordering items** — list items in the **correct** order (↑↓ to reorder);
     candidates see them shuffled.
   - **Competency tags** — tick at least one, weight 0.25–5 (drives competency scores).
4. Validation runs client-side and server-side per type:
   - multiple choice/visual → exactly 1 correct
   - multi-select → ≥2 correct
   - likert → exactly 5 options
   - scenario → one option scored 4
   - ordering → ≥2 items
   - open-ended → no options; automatically flagged for rubric review.

### Sections
Sections belong to a version. Use **Versions & Links → Assessment sections**
to add, edit and remove sections in a draft. A version cannot be published
while any section is empty.

---

## 5. Courses, weights, competencies

- **Courses** — create new pathways and edit display copy, career family, CTA URL, minimum recommended
  score (default 65), learning-journey steps (one per line), display order and
  active flag. Deactivating removes the course from *future* scoring.
- **Weights** — the 0–5 competency matrix (courses × competencies). Cells colour
  by intensity; save is one bulk request. `0` = irrelevant, `3` = important,
  `5` = defining. Changes affect **future** scoring runs only.
- **Competencies** — rename/describe/deactivate. Prefer *deactivate* over delete:
  historical scores reference competency IDs. Codes are immutable once created.

---

## 6. Settings

Grouped cards; toggle/number/select controls; the component-weight card shows a
running total that should equal **100**.

| Group | What it controls |
| --- | --- |
| Recommendation thresholds | min score, multi-path/secondary ranges, HIGH/MODERATE confidence conditions, completeness floors |
| Component weights | share of the final score per component (40/30/15/10/5 by default) |
| Assessment & timer | timer mode (overall/per-section/none), duration, allow-going-back |
| Randomisation & integrity | question/option shuffling, rapid-completion %, inactivity threshold |

Nothing in scoring or recommendations is hard-coded — these values *are* the
rules. Unsaved changes are counted; **Save settings** commits them and logs an
audit entry. Existing reports keep their stored scores.

---

## 7. Reviewing candidates

**Candidates** list: search by name/email/phone, filter by status/version, export
CSV (admin & admissions).

**Detail page** shows:
- profile (education, occupation, exposure, hours, format) and attempt metadata
  (link, version, timing, answered count, report link);
- integrity flags — rapid completion, long inactivity, auto-submit, time used %;
- overall score + completeness, recommendation (profile, confidence, primary,
  secondary), component and section score bars, competency radar;
- course-fit ranking with PRIMARY/ALSO badges and each course's threshold marker;
- internal rationale (why this recommendation);
- **question-by-question review** — the candidate's choices next to the correct
  answers, with per-question timing.

### Rubric scoring (open-ended)
Admin & Instructor only:
1. Read the free-text answer.
2. Click a rubric score **0–4** (0 irrelevant … 4 excellent). It saves instantly
   (`4 = 100%`, `0 = 0%`), records you as reviewer, re-runs the scoring pipeline
   and refreshes the report.
3. The banner/dashboard counter drops as responses are scored.

Candidates never see correct answers, rubric scores, weights or competency tags —
their report contains only narrative results.

---

## 8. CSV export

**Candidates → Export CSV** (or pass the same filters):

- Filters applied before export: status, version (plus date/course/confidence via
  `/api/admin/export?from=…&to=…&course=…&confidence=…`).
- Columns: candidate ID, name, email, phone, date, version, status, duration,
  overall score, completeness, primary + secondary recommendation, profile,
  confidence, **all 16 competencies**, **all 13 course scores**.
- UTF-8 with BOM → opens correctly in Excel (₦ etc. safe). Max 5 000 rows.

---

## 9. Security habits

- All content/config changes are **audit-logged** with your user ID and IP.
- Rotate `AUTH_SECRET` if a session leak is suspected (invalidates all logins).
- Never share the `/admin` cookie; sign out on shared machines.
- Candidate attempt tokens are unguessable; report links are effectively
  single-candidate credentials — treat them as sensitive.
