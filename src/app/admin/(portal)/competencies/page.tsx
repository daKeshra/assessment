import CompetenciesClient from "@/components/admin/CompetenciesClient";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Competencies | Africinnovate Admin" };

export default async function CompetenciesPage() {
  const competencies = await db.competency.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { questionMappings: true, courseWeights: true } } },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Competencies</h1>
        <p className="text-sm text-slate-500">
          The {competencies.length} competencies measured by the assessment. Deactivate
          rather than delete - historical scores reference these records.
        </p>
      </div>
      <CompetenciesClient
        items={competencies.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description,
          active: c.active,
          questionCount: c._count.questionMappings,
          courseWeightCount: c._count.courseWeights,
        }))}
      />
    </div>
  );
}
