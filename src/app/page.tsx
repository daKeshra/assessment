import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "1", title: "Tell us about yourself", text: "A short form - no technical knowledge required." },
  { n: "2", title: "Take the assessment", text: "Questions across reasoning, problem solving and interests." },
  { n: "3", title: "Get your technology profile", text: "Your strengths, primary pathway and alternatives worth exploring." },
  { n: "4", title: "Start learning", text: "A recommended starting point with a clear learning journey." },
];

export default async function LandingPage() {
  const [assessment, courses] = await Promise.all([
    db.assessment.findFirst({ where: { status: "ACTIVE" }, include: { version: true } }),
    db.course.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      take: 13,
    }),
  ]);

  // Read the count from the published version so the marketing copy can never
  // drift from the seeded question bank again.
  const questionCount = assessment?.version
    ? await db.question.count({
        where: { active: true, section: { assessmentVersionId: assessment.version.id } },
      })
    : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white no-print">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-auto" />
          </div>
          <Link href="/admin/login" className="text-sm font-semibold text-slate-600 hover:text-brand-600">
            Staff login
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 text-center">
            <p className="inline-block rounded-full bg-white/15 px-4 py-1 text-sm font-medium mb-6">
              For beginners, career switchers and the curious
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Which technology path fits the way
              <br className="hidden sm:block" /> you think, solve and create?
            </h1>
            <p className="mt-5 mx-auto max-w-2xl text-base sm:text-lg text-brand-100">
              The Africinnovate Technology Career Aptitude Assessment measures how you reason, investigate
              and work through problems - then recommends the learning pathway where you are most
              likely to perform well.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {assessment ? (
                <Link
                  href={`/a/${assessment.token}`}
                  className="btn bg-white text-brand-700 hover:bg-brand-50 px-7 py-3 text-base"
                >
                  Start the assessment
                </Link>
              ) : (
                <span className="btn bg-white/20 text-white px-7 py-3 text-base">
                  Assessment link coming soon
                </span>
              )}
              <span className="text-sm text-brand-100">
                {questionCount} questions &middot; about 55&ndash;70 minutes &middot; free
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold text-center">How it works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-sm">
                  {s.n}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border-y border-slate-200">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-bold text-center">13 learning pathways</h2>
            <p className="mt-2 text-center text-slate-600 max-w-2xl mx-auto text-sm">
              We do not ask which course you want. We measure aptitude first, then match it against
              what each pathway actually requires.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-semibold text-sm">{c.courseName}</p>
                  <p className="text-xs text-slate-500">{c.careerFamily}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold">Not sure where you fit?</h2>
          <p className="mt-3 text-slate-600">
            That is exactly what this assessment is for. It is an aptitude-based suggestion, not a
            verdict - you can retake it as you grow.
          </p>
          {assessment ? (
            <Link href={`/a/${assessment.token}`} className="btn btn-primary mt-6 px-8 py-3 text-base">
              Begin now
            </Link>
          ) : null}
          <p className="mt-8 text-xs text-slate-500">
            This assessment provides an aptitude-based learning recommendation. It does not
            determine your ability or guarantee success in a particular career.
          </p>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 text-sm no-print">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} Africinnovate. All rights reserved.</p>
          <p>Technology Career Aptitude Assessment v1.0</p>
        </div>
      </footer>
    </div>
  );
}
