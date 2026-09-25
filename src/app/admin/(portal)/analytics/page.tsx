import Link from "next/link";
import CompetencyRadar from "@/components/charts/CompetencyRadar";
import CourseDistribution from "@/components/charts/CourseDistribution";
import {
  AttemptTrendChart,
  DifficultyPerformanceChart,
  ScoreBandChart,
  SectionPerformanceChart,
} from "@/components/charts/AnalyticsCharts";
import { getAssessmentAnalytics } from "@/lib/analytics-data";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics | Africinnovate Admin" };

function value(value: number | null, suffix = "") {
  return value == null ? "—" : `${value}${suffix}`;
}

function percent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function Metric({ label, value: display, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{display}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const versionId = typeof params.version === "string" ? params.version : "ALL";
  const courseCode = typeof params.course === "string" ? params.course : "ALL";
  const confidence = typeof params.confidence === "string" ? params.confidence : "ALL";
  const status = typeof params.status === "string" ? params.status : "ALL";
  const [{ summary }, versions, courses] = await Promise.all([
    getAssessmentAnalytics({ from, to, versionId, courseCode, confidence, status }),
    db.assessmentVersion.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, versionName: true, versionNumber: true, status: true },
    }),
    db.course.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      select: { courseCode: true, courseName: true },
    }),
  ]);

  const activeFilter =
    from || to || versionId !== "ALL" || courseCode !== "ALL" || confidence !== "ALL" || status !== "ALL";
  const maxQuestionRows = Math.min(12, summary.questionPerformance.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-brand-600 hover:underline">
            &larr; Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Assessment analytics</h1>
          <p className="text-sm text-slate-500">
            Understand completion, performance, recommendations and question quality across attempts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
            {summary.totalAttempts} attempts in view
          </span>
        </div>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" method="get">
        <label className="label mb-0">
          From
          <input className="input mt-1" type="date" name="from" defaultValue={from} />
        </label>
        <label className="label mb-0">
          To
          <input className="input mt-1" type="date" name="to" defaultValue={to} />
        </label>
        <label className="label mb-0">
          Assessment version
          <select className="input mt-1" name="version" defaultValue={versionId}>
            <option value="ALL">All versions</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.versionName} v{version.versionNumber} ({version.status})
              </option>
            ))}
          </select>
        </label>
        <label className="label mb-0">
          Course
          <select className="input mt-1" name="course" defaultValue={courseCode}>
            <option value="ALL">All courses</option>
            {courses.map((course) => (
              <option key={course.courseCode} value={course.courseCode}>{course.courseName}</option>
            ))}
          </select>
        </label>
        <label className="label mb-0">
          Confidence
          <select className="input mt-1" name="confidence" defaultValue={confidence}>
            <option value="ALL">All confidence levels</option>
            <option value="HIGH">High</option>
            <option value="MODERATE">Moderate</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label className="label mb-0">
          Status
          <select className="input mt-1" name="status" defaultValue={status}>
            <option value="ALL">All statuses</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="TIMED_OUT">Timed out</option>
            <option value="ABANDONED">Abandoned</option>
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
          <button type="submit" className="btn btn-primary">Apply filters</button>
          {activeFilter ? (
            <Link href="/admin/analytics" className="btn btn-secondary">Clear</Link>
          ) : null}
        </div>
      </form>

      {summary.pendingAiReview > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>{summary.pendingAiReview}</strong> open-ended response{summary.pendingAiReview === 1 ? "" : "s"} need an AI suggestion or human rubric review.{" "}
          <Link href="/admin/candidates" className="font-semibold underline">Open candidate review</Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Attempts" value={String(summary.totalAttempts)} hint={`${summary.inProgressAttempts} in progress`} />
        <Metric label="Completion rate" value={percent(summary.completionRate)} hint={`${summary.completedAttempts} completed`} />
        <Metric label="Average score" value={value(summary.averageScore)} hint={`${summary.scoredAttempts} scored reports`} />
        <Metric label="Average duration" value={value(summary.averageDurationMinutes, " min")} hint={`${percent(summary.averageCompleteness)} average completeness`} />
        <Metric label="CTA acceptance" value={percent(summary.recommendationAcceptanceRate)} hint={`${summary.ctaClicks} tracked course clicks`} />
      </div>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">Attempt volume over time</h2>
            <p className="text-xs text-slate-500">Started and completed attempts by start date</p>
          </div>
        </div>
        <AttemptTrendChart data={summary.dailyTrend} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold">Overall score distribution</h2>
          <p className="mb-3 text-xs text-slate-500">Completed reports grouped into score bands</p>
          <ScoreBandChart data={summary.scoreBands} />
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Question difficulty performance</h2>
          <p className="mb-3 text-xs text-slate-500">Average final score across question difficulty levels</p>
          <DifficultyPerformanceChart data={summary.difficultyAverages} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="font-bold">Section performance</h2>
          <p className="mb-3 text-xs text-slate-500">Average score by assessment section</p>
          <SectionPerformanceChart data={summary.sectionAverages} />
        </section>
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-bold">Average competency profile</h2>
          <p className="mb-2 text-xs text-slate-500">Across all scored attempts in this view</p>
          <CompetencyRadar data={summary.competencyAverages.map((item) => ({ name: item.code, score: Math.round(item.average ?? 0) }))} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold">Recommendation distribution</h2>
          <p className="mb-3 text-xs text-slate-500">Primary pathway across scored reports</p>
          <CourseDistribution data={summary.recommendationDistribution} />
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Profile and confidence</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <DistributionList title="Career family" data={summary.careerFamilyDistribution} />
            <DistributionList title="Profile" data={summary.profileDistribution} />
            <DistributionList title="Confidence" data={summary.confidenceDistribution} />
            <DistributionList title="Tracked events" data={summary.eventDistribution} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold">Version comparison</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Version</th><th>Attempts</th><th>Completed</th><th>Average score</th></tr></thead>
              <tbody>
                {summary.versionBreakdown.map((row) => (
                  <tr key={row.version}>
                    <td className="font-medium">{row.version}</td>
                    <td>{row.attempts}</td>
                    <td>{row.completed}</td>
                    <td>{value(row.averageScore)}</td>
                  </tr>
                ))}
                {summary.versionBreakdown.length === 0 ? <tr><td colSpan={4} className="text-center text-slate-500">No version data.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Integrity signals</h2>
          <p className="mt-1 text-xs text-slate-500">Flags recorded by the assessment engine</p>
          <div className="mt-4 space-y-2">
            {summary.integrityFlags.length === 0 ? <p className="text-sm text-slate-500">No integrity flags recorded.</p> : summary.integrityFlags.map((flag) => (
              <div key={flag.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{flag.name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
                <strong>{flag.count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">Question performance watchlist</h2>
            <p className="text-xs text-slate-500">Lowest-average questions first; use this to review difficulty and answer-key quality.</p>
          </div>
          <span className="text-xs text-slate-500">{summary.questionPerformance.length} questions scored</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Question</th><th>Section</th><th>Difficulty</th><th>Responses</th><th>Average</th></tr></thead>
            <tbody>
              {summary.questionPerformance.slice(0, maxQuestionRows).map((question) => (
                <tr key={question.id}>
                  <td className="max-w-md truncate font-medium" title={question.prompt}>{question.prompt}</td>
                  <td>{question.section}</td>
                  <td>{question.difficulty}</td>
                  <td>{question.count}</td>
                  <td><strong className={question.average < 50 ? "text-rose-600" : ""}>{Math.round(question.average)}%</strong></td>
                </tr>
              ))}
              {summary.questionPerformance.length === 0 ? <tr><td colSpan={5} className="text-center text-slate-500">No scored responses yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DistributionList({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 space-y-2">
        {data.length === 0 ? <p className="text-sm text-slate-500">No data.</p> : data.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-600">{row.name.replaceAll("_", " ")}</span>
            <strong>{row.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
