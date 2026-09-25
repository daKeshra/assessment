import Link from "next/link";
import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseProgression(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export default async function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const course = await db.course.findUnique({ where: { courseCode: code } });
  if (!course || !course.active) notFound();

  const progression = parseProgression(course.progressionJson);
  const registrationHref = `mailto:admissions@africinnovate.com?subject=${encodeURIComponent(`Course enquiry: ${course.courseName}`)}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="Africinnovate home"><BrandLogo className="h-8 w-auto" /></Link>
          <span className="text-xs text-slate-500">Technology learning pathway</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <section className="rounded-2xl bg-gradient-to-br from-brand-900 to-brand-600 px-6 py-10 text-white sm:px-10">
          <p className="text-sm font-medium text-brand-100">{course.careerFamily ?? "Technology pathway"}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{course.courseName}</h1>
          {course.description ? <p className="mt-4 max-w-2xl text-brand-100">{course.description}</p> : null}
          <a href={registrationHref} className="btn mt-6 bg-white px-6 py-3 text-brand-700 hover:bg-brand-50">
            Enquire about this course
          </a>
        </section>

        <section className="card p-6 sm:p-8">
          <h2 className="text-xl font-bold">Your suggested learning journey</h2>
          {progression.length > 0 ? (
            <ol className="mt-5 space-y-4">
              {progression.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{index + 1}</span>
                  <span className="pt-1 text-sm font-medium text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Course curriculum details are being prepared.</p>
          )}
        </section>

        <section className="rounded-xl border border-brand-200 bg-brand-50 p-5 text-sm text-brand-900">
          <strong>Ready to take the next step?</strong> Contact the Africinnovate admissions team to discuss schedule, eligibility and enrolment.
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Africinnovate
      </footer>
    </div>
  );
}
