import Link from "next/link";
import { VersionBadge } from "@/components/admin/badges";
import { getSession } from "@/lib/auth";
import {
  COMPONENT_LABELS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
} from "@/lib/constants";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questions | Africinnovate Admin" };

const TYPES = [
  "ALL",
  "MULTIPLE_CHOICE",
  "MULTIPLE_SELECT",
  "LIKERT",
  "SCENARIO",
  "OPEN_ENDED",
  "VISUAL",
  "ORDERING",
];

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const type = typeof params.type === "string" ? params.type : "ALL";
  const active = typeof params.active === "string" ? params.active : "ALL";
  const versionId = typeof params.version === "string" ? params.version : "ALL";

  const [versions, questions] = await Promise.all([
    db.assessmentVersion.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, versionName: true, versionNumber: true, status: true },
    }),
    db.question.findMany({
      where: {
        type: type === "ALL" ? undefined : type,
        active: active === "ALL" ? undefined : active === "true",
        section:
          versionId === "ALL" ? undefined : { assessmentVersionId: versionId },
        OR: q
          ? [{ prompt: { contains: q } }, { section: { name: { contains: q } } }]
          : undefined,
      },
      take: 300,
      orderBy: [{ section: { position: "asc" } }, { position: "asc" }],
      include: {
        section: { include: { version: true } },
        competencies: { include: { competency: true } },
        _count: { select: { options: true, responses: true } },
      },
    }),
  ]);

  const hasDraft = versions.some((v) => v.status === "DRAFT");
  const draftSections = await db.section.findMany({
    where: { version: { status: "DRAFT" } },
    orderBy: [{ assessmentVersionId: "asc" }, { position: "asc" }],
    include: { version: { select: { versionName: true, versionNumber: true } } },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Question bank</h1>
          <p className="text-sm text-slate-500">
            {questions.length} question{questions.length === 1 ? "" : "s"} matching
            filters &middot; published versions are read-only
          </p>
        </div>
        <Link
          href={hasDraft ? "/admin/questions/new" : "/admin/versions"}
          className="btn btn-primary"
          title={hasDraft ? undefined : "Create a draft version first"}
        >
          New question
        </Link>
      </div>

      {!hasDraft ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Published versions are immutable. To add or edit questions, duplicate a
          published version into a draft from{" "}
          <Link href="/admin/versions" className="font-semibold underline">
            Versions &amp; Links
          </Link>
          .
        </div>
      ) : null}

      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor="q">
            Search prompt or section
          </label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="e.g. pattern" />
        </div>
        <div>
          <label className="label" htmlFor="type">
            Type
          </label>
          <select id="type" name="type" defaultValue={type} className="input">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "ALL" ? "All types" : QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="active">
            Status
          </label>
          <select id="active" name="active" defaultValue={active} className="input">
            <option value="ALL">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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
                v{v.versionNumber} · {v.status}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Apply
        </button>
        {q || type !== "ALL" || active !== "ALL" || versionId !== "ALL" ? (
          <Link href="/admin/questions" className="btn btn-secondary">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>#</th>
              <th>Prompt</th>
              <th>Section</th>
              <th>Type</th>
              <th>Difficulty</th>
              <th>Version</th>
              <th>Competencies</th>
              <th className="text-right">Answers</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {questions.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500">
                  No questions match these filters.
                </td>
              </tr>
            ) : (
              questions.map((question) => {
                const isDraft = question.section.version.status === "DRAFT";
                return (
                  <tr key={question.id} className="hover:bg-slate-50">
                    <td className="text-xs text-slate-400">{question.position}</td>
                    <td className="max-w-md">
                      <p className="line-clamp-2 text-sm font-medium">
                        {question.prompt}
                      </p>
                      {!question.active ? (
                        <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                          INACTIVE
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-sm text-slate-600">
                      {question.section.code} · {question.section.name}
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </td>
                    <td className="text-sm text-slate-600">
                      {DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}
                    </td>
                    <td className="whitespace-nowrap">
                      <VersionBadge status={question.section.version.status} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {question.competencies.map((c) => (
                          <span
                            key={c.id}
                            className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700"
                            title={c.competency.name}
                          >
                            {c.competency.code} ×{c.weight}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right text-sm text-slate-500">
                      {question._count.responses}
                    </td>
                    <td className="text-right">
                      {isDraft ? (
                        <Link
                          href={`/admin/questions/${question.id}`}
                          className="text-sm font-semibold text-brand-600 hover:underline"
                        >
                          Edit
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">Read-only</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {draftSections.length > 0 ? (
        <p className="text-xs text-slate-500">
          Editing is available in draft sections:{" "}
          {draftSections
            .map((s) => `${s.code} (${s.version.versionName} v${s.version.versionNumber})`)
            .join(", ")}
          .
        </p>
      ) : null}
    </div>
  );
}
