import Link from "next/link";
import { ConfidenceBadge, ProfileBadge, StatusBadge } from "@/components/admin/badges";
import { canExport, getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates | Africinnovate Admin" };

const STATUSES = ["ALL", "IN_PROGRESS", "SUBMITTED", "TIMED_OUT", "ABANDONED"];

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status : "ALL";
  const versionId = typeof params.version === "string" ? params.version : "ALL";

  const [versions, attempts] = await Promise.all([
    db.assessmentVersion.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, versionName: true, versionNumber: true },
    }),
    db.attempt.findMany({
      where: {
        status: status === "ALL" ? undefined : status,
        assessmentVersionId: versionId === "ALL" ? undefined : versionId,
        OR: q
          ? [
              { candidate: { fullName: { contains: q } } },
              { candidate: { email: { contains: q } } },
              { candidate: { phone: { contains: q } } },
            ]
          : undefined,
      },
      orderBy: { startTime: "desc" },
      take: 300,
      include: {
        candidate: true,
        version: true,
        report: true,
        recommendation: { include: { primaryCourse: true } },
        _count: { select: { responses: true } },
      },
    }),
  ]);

  const exportParams = new URLSearchParams();
  if (status !== "ALL") exportParams.set("status", status);
  if (versionId !== "ALL") exportParams.set("version", versionId);
  const exportQuery = exportParams.toString();
  const exportUrl = exportQuery ? `/api/admin/export?${exportQuery}` : "/api/admin/export";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Candidates</h1>
          <p className="text-sm text-slate-500">
            {attempts.length} attempt{attempts.length === 1 ? "" : "s"} matching current filters
          </p>
        </div>
        {session && canExport(session.role) ? (
          <a href={exportUrl} className="btn btn-secondary">
            Export CSV
          </a>
        ) : null}
      </div>

      {/* filters */}
      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">
            Search name, email or phone
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="input"
            placeholder="e.g. Ada or ada@example.com"
          />
        </div>
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="input">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : s.replace("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="version">
            Version
          </label>
          <select id="version" name="version" defaultValue={versionId} className="input">
            <option value="ALL">All versions</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.versionName} v{v.versionNumber}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Apply filters
        </button>
        {q || status !== "ALL" || versionId !== "ALL" ? (
          <Link href="/admin/candidates" className="btn btn-secondary">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Status</th>
              <th>Started</th>
              <th>Version</th>
              <th className="text-right">Score</th>
              <th>Recommendation</th>
              <th>Profile</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-500">
                  No attempts match these filters.
                </td>
              </tr>
            ) : (
              attempts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td>
                    <p className="font-semibold">{a.candidate.fullName}</p>
                    <p className="text-xs text-slate-500">{a.candidate.email}</p>
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="whitespace-nowrap text-sm text-slate-600">
                    {a.startTime.toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="text-sm text-slate-600">
                    v{a.version.versionNumber}
                  </td>
                  <td className="text-right font-bold">
                    {a.report ? Math.round(a.report.overallScore) : "—"}
                  </td>
                  <td className="text-sm">
                    {a.recommendation ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {a.recommendation.primaryCourse?.courseName ??
                            (a.recommendation.profileType === "EXPLORER"
                              ? "Explorer"
                              : "—")}
                        </span>
                        <ConfidenceBadge value={a.recommendation.confidence} />
                      </div>
                    ) : (
                      <span className="text-slate-400">Not scored</span>
                    )}
                  </td>
                  <td>
                    {a.recommendation ? (
                      <ProfileBadge value={a.recommendation.profileType} />
                    ) : null}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/candidates/${a.id}`}
                      className="text-sm font-semibold text-brand-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
