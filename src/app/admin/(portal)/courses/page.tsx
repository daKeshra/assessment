import CoursesClient, { type CourseRow } from "@/components/admin/CoursesClient";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courses | Africinnovate Admin" };

export default async function CoursesPage() {
  const courses = await db.course.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { competencyWeights: true } } },
  });

  const rows: CourseRow[] = courses.map((c) => ({
    id: c.id,
    courseCode: c.courseCode,
    courseName: c.courseName,
    description: c.description,
    careerFamily: c.careerFamily,
    ctaUrl: c.ctaUrl,
    progression: (() => {
      try {
        return (JSON.parse(c.progressionJson ?? "[]") as string[]) ?? [];
      } catch {
        return [];
      }
    })(),
    minimumScore: c.minimumScore,
    active: c.active,
    displayOrder: c.displayOrder,
    weightCount: c._count.competencyWeights,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Courses</h1>
        <p className="text-sm text-slate-500">
          The {rows.length} pathways candidates can be recommended. Edit copy, CTAs,
          thresholds and the learning journey here; competency weights live on the
          Weights page.
        </p>
      </div>
      <CoursesClient courses={rows} />
    </div>
  );
}
