import Link from "next/link";
import { notFound } from "next/navigation";
import CompetencyRadar from "@/components/charts/CompetencyRadar";
import RubricScorer from "@/components/admin/RubricScorer";
import {
  ConfidenceBadge,
  ProfileBadge,
  ScoreBar,
  StatusBadge,
} from "@/components/admin/badges";
import { canScoreResponses, getSession } from "@/lib/auth";
import { COMPONENT_LABELS, PROFILE_LABELS, SETTING_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { getAllSettings, numOf } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidate detail | Africinnovate Admin" };

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const RUBRIC_LABELS = ["No response", "Minimal", "Partial", "Solid", "Excellent"];

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const attempt = await db.attempt.findUnique({
    where: { id },
    include: {
      candidate: true,
      assessment: true,
      version: true,
      report: true,
      recommendation: { include: { primaryCourse: true } },
      competencyScores: { include: { competency: true } },
      courseScores: { include: { course: true }, orderBy: { rank: "asc" } },
      responses: {
        include: {
          score: true,
          question: {
            include: {
              section: true,
              options: { orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!attempt) notFound();

  const completed = ["SUBMITTED", "TIMED_OUT"].includes(attempt.status);
  const rec = attempt.recommendation;
  const report = attempt.report;
  const explanation = parse<{
    reasons?: string[];
    interestNote?: string | null;
    explorerMessage?: string | null;
  }>(rec?.explanationJson ?? null, {});

  const componentScores = parse<Record<string, number | null>>(
    report?.componentScoresJson ?? null,
    {},
  );
  const sectionScores = parse<Record<string, number>>(report?.sectionScoresJson ?? null, {});

  const versionSections = await db.section.findMany({
    where: { assessmentVersionId: attempt.assessmentVersionId },
    orderBy: { position: "asc" },
  });

  // All questions in this version, paired with this attempt's response (if any).
  const allQuestions = await db.question.findMany({
    where: { section: { assessmentVersionId: attempt.assessmentVersionId }, active: true },
    include: { section: true, options: { orderBy: { position: "asc" } } },
    orderBy: [{ section: { position: "asc" } }, { position: "asc" }],
  });
  const responseByQ = Object.fromEntries(attempt.responses.map((r) => [r.questionId, r]));

  const flags = parse<{
    autoSubmitted?: boolean;
    rapidCompletion?: boolean;
    inactiveNearEnd?: boolean;
    durationRatio?: number | null;
  } | null>(attempt.flagsJson, null);

  const minRecommend = numOf(
    await getAllSettings(),
    SETTING_KEYS.MIN_RECOMMEND_SCORE,
    65,
  ); // threshold marker on course bars

  const radarData = attempt.competencyScores.map((s) => ({
    name: s.competency.name.length > 18 ? s.competency.code : s.competency.name,
    score: Math.round(s.score),
  }));

  const secondaryCodes = parse<string[]>(rec?.secondaryCourseIds ?? null, []);

  const answeredCount = attempt.responses.filter(
    (r) =>
      (r.selectedOptionIds && JSON.parse(r.selectedOptionIds).length > 0) ||
      (r.textResponse ?? "").trim().length > 0,
  ).length;

  const canScore = session ? canScoreResponses(session.role) : false;
  const pendingManual = allQuestions.filter((q) => {
    const response = responseByQ[q.id];
    if (!q.requiresManualScore || !response) return false;
    const score = response.score;
    return !score || (score.aiScore != null && score.humanScore == null);
  }).length;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/candidates"
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            &larr; All candidates
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            {attempt.candidate.fullName}
          </h1>
          <p className="text-sm text-slate-500">
            {attempt.candidate.email} &middot; {attempt.candidate.phone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={attempt.status} />
          {rec ? <ProfileBadge value={rec.profileType} /> : null}
          {rec ? <ConfidenceBadge value={rec.confidence} /> : null}
        </div>
      </div>

      {/* candidate profile + flags */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Candidate profile
          </h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Education", attempt.candidate.educationLevel],
              ["Occupation", attempt.candidate.occupation],
              ["Age range", attempt.candidate.ageRange],
              ["Tech exposure", attempt.candidate.techExposure],
              ["Hours per week", attempt.candidate.hoursPerWeek],
              ["Preferred format", attempt.candidate.preferredFormat],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Attempt
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Link</dt>
              <dd className="font-medium">{attempt.assessment.title}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Version</dt>
              <dd className="font-medium">
                {attempt.version.versionName} v{attempt.version.versionNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Started</dt>
              <dd className="font-medium">
                {attempt.startTime.toLocaleString("en-GB")}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Submitted</dt>
              <dd className="font-medium">
                {attempt.submissionTime?.toLocaleString("en-GB") ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-medium">
                {attempt.durationSeconds
                  ? `${Math.round(attempt.durationSeconds / 60)} min`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Answered</dt>
              <dd className="font-medium">
                {answeredCount} / {allQuestions.length}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Report link</dt>
              <dd>
                {completed ? (
                  <Link
                    href={`/report/${attempt.token}`}
                    target="_blank"
                    className="font-semibold text-brand-600 hover:underline"
                  >
                    Open candidate report
                  </Link>
                ) : (
                  <span className="text-slate-400">Not available yet</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Integrity flags
          </h2>
          {!flags ? (
            <p className="text-sm text-slate-500">No flags recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <li>
                {flags.rapidCompletion ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Rapid completion
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Normal pace
                  </span>
                )}
              </li>
              <li>
                {flags.inactiveNearEnd ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Long inactivity near the end
                  </span>
                ) : null}
              </li>
              <li>
                {flags.autoSubmitted ? (
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    Auto-submitted on timeout
                  </span>
                ) : null}
              </li>
              {flags.durationRatio != null ? (
                <li className="text-slate-600">
                  Used {Math.round(flags.durationRatio * 100)}% of the allowed time.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      </div>

      {/* scores */}
      {report || rec ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Overall result
            </h2>
            <p className="mt-2 text-5xl font-extrabold tracking-tight">
              {report ? Math.round(report.overallScore) : "—"}
              <span className="text-lg font-semibold text-slate-400">/100</span>
            </p>
            {report ? (
              <>
                <div className="mt-3">
                  <ScoreBar value={report.overallScore} threshold={minRecommend} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {Math.round(report.completeness * 100)}% complete
                  {report.simulationScore != null
                    ? ` · practical simulation ${Math.round(report.simulationScore)}`
                    : ""}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Not scored yet.</p>
            )}
            {rec ? (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Recommendation
                </p>
                <p className="font-bold">
                  {rec.primaryCourse?.courseName ??
                    (rec.profileType === "EXPLORER" ? "Technology Explorer" : "—")}
                </p>
                <p className="text-xs text-slate-500">
                  {PROFILE_LABELS[rec.profileType] ?? rec.profileType}
                  {rec.profileFamily ? ` · ${rec.profileFamily}` : ""}
                </p>
                {secondaryCodes.length > 0 ? (
                  <p className="text-xs text-slate-600">
                    Also: {secondaryCodes.join(", ")}
                  </p>
                ) : null}
                {rec.confidenceValue != null ? (
                  <p className="text-xs text-slate-500">
                    Confidence value {Math.round(rec.confidenceValue * 100) / 100}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="card p-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Component scores
            </h2>
            <div className="space-y-3">
              {Object.entries(componentScores).map(([component, value]) => (
                <div key={component}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-600">
                      {COMPONENT_LABELS[component] ?? component}
                    </span>
                    <span className="font-bold">
                      {value == null ? "—" : Math.round(value)}
                    </span>
                  </div>
                  <ScoreBar value={value ?? 0} />
                </div>
              ))}
              {Object.keys(componentScores).length === 0 ? (
                <p className="text-sm text-slate-500">No component scores recorded.</p>
              ) : null}
            </div>

            <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-slate-500">
              Section scores
            </h2>
            <div className="space-y-2">
              {versionSections.map((s) => {
                const value = sectionScores[s.id];
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {s.code} · {s.name}
                    </span>
                    <span className="font-bold">
                      {value != null ? Math.round(value) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Competency profile
            </h2>
            <CompetencyRadar data={radarData} />
          </div>
        </div>
      ) : null}

      {/* course ranking */}
      {attempt.courseScores.length > 0 ? (
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Course fit ranking</h2>
          <div className="space-y-3">
            {attempt.courseScores.map((cs) => {
              const isPrimary = rec?.primaryCourseId === cs.courseId;
              const isSecondary = secondaryCodes.includes(cs.course.courseCode);
              return (
                <div key={cs.id} className="flex items-center gap-4">
                  <span className="w-6 text-center text-xs font-bold text-slate-400">
                    #{cs.rank}
                  </span>
                  <span className="w-56 shrink-0 truncate text-sm font-medium">
                    {cs.course.courseName}
                    {isPrimary ? (
                      <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                        PRIMARY
                      </span>
                    ) : isSecondary ? (
                      <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                        ALSO
                      </span>
                    ) : null}
                  </span>
                  <div className="flex-1">
                    <ScoreBar
                      value={cs.score}
                      threshold={cs.course.minimumScore}
                      color={
                        isPrimary
                          ? "bg-brand-500"
                          : cs.score >= cs.course.minimumScore
                            ? "bg-emerald-400"
                            : "bg-slate-300"
                      }
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-bold">
                    {Math.round(cs.score)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Vertical markers show each course&apos;s minimum recommended score (default{" "}
            {minRecommend}).
          </p>
        </section>
      ) : null}

      {/* recommendation explanation */}
      {rec && (explanation.reasons?.length || explanation.interestNote) ? (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Recommendation rationale (internal)</h2>
          <ul className="space-y-2">
            {(explanation.reasons ?? []).map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="font-bold text-brand-600">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ul>
          {explanation.interestNote ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm italic text-slate-600">
              {explanation.interestNote}
            </p>
          ) : null}
          {explanation.explorerMessage ? (
            <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-800">
              {explanation.explorerMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* question-by-question review */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Question-by-question review</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {pendingManual > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                {pendingManual} awaiting human rubric confirmation
              </span>
            ) : null}
            {!canScore ? (
              <span>Your role can view but not score responses.</span>
            ) : null}
          </div>
        </div>

        <ol className="space-y-4">
          {allQuestions.map((q, idx) => {
            const response = responseByQ[q.id];
            const selected = response
              ? (parse<string[]>(response.selectedOptionIds, []) ?? [])
              : [];
            const text = response?.textResponse ?? "";
            const orderingItems =
              q.type === "ORDERING"
                ? parse<{ id: string; text: string }[]>(q.itemsJson, [])
                : [];
            const answered =
              selected.length > 0 || (text ?? "").trim().length > 0;

            return (
              <li key={q.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                    Q{idx + 1}
                  </span>
                  <span className="text-slate-500">
                    {q.section.code} · {q.section.name}
                  </span>
                  {q.requiresManualScore ? (
                    <span className="rounded bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">
                      Manual rubric
                    </span>
                  ) : null}
                  {!answered ? (
                    <span className="rounded bg-rose-50 px-2 py-0.5 font-semibold text-rose-600">
                      Not answered
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm font-medium text-slate-800">{q.prompt}</p>

                {/* objective options */}
                {q.options.length > 0 && q.type !== "OPEN_ENDED" ? (
                  <ul className="mt-3 space-y-1.5">
                    {q.options.map((o) => {
                      const chosen = selected.includes(o.id);
                      return (
                        <li
                          key={o.id}
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                            chosen
                              ? o.isCorrect
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-rose-300 bg-rose-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                chosen
                                  ? o.isCorrect
                                    ? "bg-emerald-500 text-white"
                                    : "bg-rose-500 text-white"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {chosen ? (o.isCorrect ? "✓" : "✕") : ""}
                            </span>
                            {o.text}
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-[11px]">
                            {o.isCorrect ? (
                              <span className="font-bold text-emerald-700">Correct</span>
                            ) : null}
                            {q.type === "SCENARIO" ? (
                              <span className="text-slate-500">score {o.score}</span>
                            ) : null}
                            {chosen ? (
                              <span className="font-bold text-slate-700">Chosen</span>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {/* ordering items as submitted (positions shown via selected order) */}
                {q.type === "ORDERING" && response ? (
                  <ol className="mt-3 list-decimal list-inside space-y-1 text-sm text-slate-700">
                    {selected.map((itemId) => {
                      const item = orderingItems.find((entry) => entry.id === itemId);
                      return <li key={itemId}>{item?.text ?? itemId}</li>;
                    })}
                  </ol>
                ) : null}

                {/* free text */}
                {q.type === "OPEN_ENDED" ? (
                  <div className="mt-3">
                    <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      {text || <span className="text-slate-400">(no answer given)</span>}
                    </p>
                    {response && canScore && completed ? (
                      <div className="mt-3">
                        <RubricScorer
                          responseId={response.id}
                          current={response.score?.humanScore ?? null}
                          aiScore={response.score?.aiScore ?? null}
                          aiRationale={response.score?.aiRationale ?? null}
                          aiConfidence={response.score?.aiConfidence ?? null}
                          aiModel={response.score?.aiModel ?? null}
                        />
                      </div>
                    ) : response?.score ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {response.score.humanScore != null
                          ? `Human score: ${response.score.humanScore}/4 (${RUBRIC_LABELS[Math.round(response.score.humanScore)] ?? "—"})`
                          : response.score.aiScore != null
                            ? `AI suggestion: ${response.score.aiScore}/4 · awaiting human confirmation`
                            : "Scored: —"}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* timing */}
                {response ? (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {Math.round(response.timeSpentMs / 1000)}s on this question
                    {response.score && !q.requiresManualScore
                      ? ` · scored ${Math.round(response.score.finalScore)}%`
                      : ""}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
