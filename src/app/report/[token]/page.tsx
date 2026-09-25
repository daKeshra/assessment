import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import CourseCtaLink from "@/components/CourseCtaLink";
import PrintButton from "@/components/PrintButton";
import { PROFILE_LABELS } from "@/lib/constants";
import { buildStudentReport } from "@/lib/report";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your Technology Profile" };

const BAND: { min: number; cls: string }[] = [
  { min: 85, cls: "bg-emerald-500" },
  { min: 70, cls: "bg-brand-500" },
  { min: 55, cls: "bg-amber-400" },
  { min: 0, cls: "bg-slate-300" },
];

function bandClass(label: string): string {
  if (label === "Excellent") return "bg-emerald-500";
  if (label === "Strong") return "bg-brand-500";
  if (label === "Developing") return "bg-amber-400";
  return "bg-slate-300";
}

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await buildStudentReport(token);
  if (!report) notFound();

  const profileTitle =
    report.profileType === "SINGLE" && report.primary
      ? report.primary.name
      : report.profileLabel;

  const steps = report.primary?.progression?.length
    ? report.primary.progression
    : report.multiPath
      ? [
          "Digital Foundations",
          "Exploratory projects across your shortlisted pathways",
          "Choose the pathway that fits best",
          "Specialisation course",
          "Portfolio project",
        ]
      : [
          "Digital Foundations",
          "Guided beginner project",
          "Retake this assessment",
          "Choose your specialisation",
        ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white no-print">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-auto" priority="lazy" />
          </div>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* headline */}
        <section className="rounded-2xl bg-gradient-to-br from-brand-900 to-brand-600 px-6 py-8 text-white">
          <p className="text-sm font-medium text-brand-100">
            {report.candidateFirstName}, your technology profile is ready
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{profileTitle}</h1>
          <p className="mt-2 text-brand-100">
            {report.profileFamily && report.profileType !== "SINGLE"
              ? report.profileFamily
              : "Recommended learning pathway"}
            {report.multiPath && report.secondaries.length > 0 ? (
              <span>
                {" "}
                &mdash; equally strong in{" "}
                {report.secondaries
                  .filter((s) => s.code !== report.primary?.code)
                  .map((s) => s.name)
                  .join(", ")}
              </span>
            ) : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {report.completedAt ? (
              <span className="rounded-full bg-white/15 px-3 py-1">
                Completed{" "}
                {new Date(report.completedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            ) : null}
            {report.durationMinutes ? (
              <span className="rounded-full bg-white/15 px-3 py-1">
                Took {report.durationMinutes} minutes
              </span>
            ) : null}
            <span className="rounded-full bg-white/15 px-3 py-1">Aptitude-based suggestion</span>
          </div>
        </section>

        {report.explorerMessage ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold text-amber-900">Recommended next step</h2>
            <p className="mt-1 text-sm text-amber-900">{report.explorerMessage}</p>
            <p className="mt-2 text-sm text-amber-800">
              This is not a verdict on your ability. A strong foundation phase usually changes the
              picture completely - and you can retake this assessment afterwards.
            </p>
          </section>
        ) : null}

        {/* why */}
        <section className="card p-6">
          <h2 className="text-xl font-bold">Why this pathway</h2>
          <ul className="mt-4 space-y-3">
            {report.why.map((reason, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                  {i + 1}
                </span>
                {reason}
              </li>
            ))}
          </ul>
          {report.interestNote ? (
            <p className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 italic">
              {report.interestNote}
            </p>
          ) : null}
        </section>

        {/* strengths */}
        <section className="card p-6">
          <h2 className="text-xl font-bold">Your strengths</h2>
          <div className="mt-4 space-y-3">
            {report.strengths.map((s) => (
              <div key={s.name} className="flex items-center gap-4">
                <span className="w-56 shrink-0 text-sm font-medium text-slate-700">{s.name}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`block h-full rounded-full ${bandClass(s.label)}`}
                    style={{
                      width:
                        s.label === "Excellent"
                          ? "100%"
                          : s.label === "Strong"
                            ? "82%"
                            : s.label === "Developing"
                              ? "62%"
                              : "40%",
                    }}
                  />
                </span>
                <span
                  className={`w-24 text-right text-sm font-semibold ${
                    s.label === "Excellent"
                      ? "text-emerald-600"
                      : s.label === "Strong"
                        ? "text-brand-600"
                        : s.label === "Developing"
                          ? "text-amber-600"
                          : "text-slate-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          {report.sharedStrengths.length > 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Common strengths across your shortlisted pathways:{" "}
              <strong>{report.sharedStrengths.join(", ")}</strong>
            </p>
          ) : null}
        </section>

        {/* alternatives */}
        {report.secondaries.length > 0 ? (
          <section className="card p-6">
            <h2 className="text-xl font-bold">
              {report.multiPath ? "Pathways in your cluster" : "Other pathways worth exploring"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {report.multiPath
                ? "Your scores are closely matched across these - you genuinely have options."
                : "Your profile also aligns with these. Nothing stops you from exploring them later."}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {report.secondaries
                .filter((s) => s.code !== report.primary?.code || report.multiPath)
                .map((s) => (
                  <div key={s.code} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-sm">{s.name}</p>
                    {s.description ? (
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">{s.description}</p>
                    ) : null}
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        {/* journey */}
        <section className="card p-6">
          <h2 className="text-xl font-bold">Your recommended learning journey</h2>
          <ol className="mt-4 space-y-0">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      i === 1
                        ? "bg-brand-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {i < steps.length - 1 ? <span className="w-px flex-1 bg-slate-200 my-1" /> : null}
                </div>
                <div className={`pb-5 ${i === steps.length - 1 ? "" : ""}`}>
                  <p
                    className={`text-sm ${
                      i === 1 ? "font-bold text-brand-700" : "font-medium text-slate-700"
                    }`}
                  >
                    {step}
                    {i === 1 && report.primary ? (
                      <span className="ml-2 rounded bg-brand-100 px-2 py-0.5 text-[11px] text-brand-700">
                        Recommended starting point
                      </span>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            This recommendation is a <strong>starting point</strong>, not a permanent label. Your
            interests, effort and environment also shape where you end up.
          </p>
        </section>

        {/* CTA */}
        {report.primary && report.primary.ctaUrl ? (
          <section className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-6 text-center">
            <h2 className="text-xl font-bold text-brand-900">Ready to start?</h2>
            <p className="mt-1 text-sm text-brand-800">
              Explore <strong>{report.primary.name}</strong> - see the full curriculum, schedule and
              enrolment options.
            </p>
            <CourseCtaLink
              attemptToken={token}
              courseCode={report.primary.code}
              href={report.primary.ctaUrl}
              className="btn btn-primary mt-4 px-8 py-3 text-base no-print"
            >
              Explore Recommended Course
            </CourseCtaLink>
          </section>
        ) : null}

        {/* disclaimer */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-500">
          <strong className="text-slate-600">Important:</strong> {report.disclaimer}
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white no-print">
        <div className="mx-auto max-w-4xl px-4 py-5 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Africinnovate &middot; Technology Career Aptitude Assessment
        </div>
      </footer>
    </div>
  );
}
