import WeightsMatrix, {
  type WeightCompetency,
  type WeightCourse,
} from "@/components/admin/WeightsMatrix";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weights | Africinnovate Admin" };

export default async function WeightsPage() {
  const [courses, competencies] = await Promise.all([
    db.course.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      include: { competencyWeights: true },
    }),
    db.competency.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const courseRows: WeightCourse[] = courses.map((c) => ({
    id: c.id,
    courseName: c.courseName,
    weights: Object.fromEntries(c.competencyWeights.map((w) => [w.competencyId, w.weight])),
  }));

  const competencyRows: WeightCompetency[] = competencies.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Competency weights</h1>
        <p className="text-sm text-slate-500">
          {courseRows.length} courses × {competencyRows.length} competencies
        </p>
      </div>
      <WeightsMatrix courses={courseRows} competencies={competencyRows} />
    </div>
  );
}
