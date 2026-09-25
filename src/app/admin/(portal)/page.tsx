import Link from "next/link";
import CourseDistribution from "@/components/charts/CourseDistribution";
import { ConfidenceBadge, StatusBadge } from "@/components/admin/badges";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | Africinnovate Admin" };

function StatCard({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "emerald" | "amber" | "sky";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
  };
  return (
    <div className="card p-5">
      <p className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[tone]}`}>
        {label}
      </p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const [statusRows, reports, recs, recent, pendingResponses] = await Promise.all([
    db.attempt.groupBy({ by: ["status"], _count: { _all: true } }),
    db.assessmentReport.findMany({
      select: { overallScore: true, completeness: true, attempt: { select: { status: true } } },
    }),
    db.recommendation.findMany({
      select: { primaryCourse: { select: { courseName: true } } },
    }),
    db.attempt.findMany({
      orderBy: { startTime: "desc" },
      take: 8,
      include: {
        candidate: true,
        report: true,
        recommendation: { include: { primaryCourse: true } },
      },
    }),
    db.response.findMany({
      where: { question: { requiresManualScore: true } },
      select: {
        textResponse: true,
        score: { select: { aiScore: true, humanScore: true } },
      },
    }),
  ]);

  const pendingManual = pendingResponses.filter(
    (response) =>
      Boolean(response.textResponse?.trim()) &&
      (!response.score ||
        (response.score.aiScore != null && response.score.humanScore == null)),
  ).length;

  const countByStatus = Object.fromEntries(
    statusRows.map((r) => [r.status, r._count._all]),
  ) as Record<string, number>;

  const total = statusRows.reduce((n, r) => n + r._count._all, 0);
  const completed =
    (countByStatus.SUBMITTED ?? 0) + (countByStatus.TIMED_OUT ?? 0);
  const inProgress = countByStatus.IN_PROGRESS ?? 0;

  const completedReports = reports.filter((r) =>
    ["SUBMITTED", "TIMED_OUT"].includes(r.attempt.status),
  );
  const avgScore = completedReports.length
    ? Math.round(
        completedReports.reduce((n, r) => n + r.overallScore, 0) /
          completedReports.length,
      )
    : null;
  const avgCompleteness = completedReports.length
    ? Math.round(
        (completedReports.reduce((n, r) => n + r.completeness, 0) /
          completedReports.length) *
          100,
      )
    : null;

  // Primary-course distribution (explorer/no-match grouped together).
  const distMap = new Map<string, number>();
  for (const r of recs) {
    const key = r.primaryCourse?.courseName ?? "Explorer / no match";
    distMap.set(key, (distMap.get(key) ?? 0) + 1);
  }
  const distribution = [...distMap]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const sections = await db.section.count();
  const questionCount = await db.question.count({ where: { active: true } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Technology Career Aptitude Assessment &middot; {questionCount} active
            questions across {sections} sections
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/analytics" className="btn btn-secondary">
            Open analytics
          </Link>
          <Link href="/admin/candidates" className="btn btn-secondary">
            View all candidates
          </Link>
        </div>
      </div>

      {pendingManual > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{pendingManual}</strong> open-ended response
          {pendingManual === 1 ? "" : "s"} awaiting AI suggestion or human rubric confirmation.
          Reports exclude these answers until a staff member reviews them.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attempts"
          value={total}
          hint={`${inProgress} currently in progress`}
        />
        <StatCard
          label="Completed"
          value={completed}
          tone="emerald"
          hint={total ? `${Math.round((completed / total) * 100)}% completion rate` : "No attempts yet"}
        />
        <StatCard
          label="Average score"
          value={avgScore ?? "—"}
          tone="sky"
          hint={
            avgCompleteness != null
              ? `${avgCompleteness}% average completeness`
              : "Completes after first submission"
          }
        />
        <StatCard
          label="Awaiting review"
          value={pendingManual}
          tone="amber"
          hint="Open-ended answers needing a rubric score"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Primary recommendation distribution</h2>
            <span className="text-xs text-slate-500">{recs.length} scored attempts</span>
          </div>
          <CourseDistribution data={distribution} />
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="font-bold mb-3">Recent candidates</h2>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No candidates yet. Share a link from{" "}
              <Link href="/admin/versions" className="text-brand-600 underline">
                Versions &amp; Links
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/candidates/${a.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50 rounded-lg px-2 -mx-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {a.candidate.fullName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {a.recommendation?.primaryCourse?.courseName ??
                          (a.recommendation
                            ? a.recommendation.profileType === "EXPLORER"
                              ? "Explorer"
                              : "Pending"
                            : "Not scored")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={a.status} />
                      {a.report ? (
                        <span className="text-xs font-bold text-slate-700">
                          {Math.round(a.report.overallScore)}
                        </span>
                      ) : a.recommendation ? (
                        <ConfidenceBadge value={a.recommendation.confidence} />
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
