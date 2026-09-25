import Link from "next/link";
import { notFound } from "next/navigation";
import QuestionForm, {
  draftFromQuestion,
  type QuestionDraft,
  type SectionOption,
} from "@/components/admin/QuestionForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit question | Africinnovate Admin" };

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [question, sections, competencies] = await Promise.all([
    db.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { position: "asc" } },
        competencies: { include: { competency: true } },
        section: { include: { version: true } },
      },
    }),
    db.section.findMany({
      where: { version: { status: "DRAFT" } },
      orderBy: [{ assessmentVersionId: "asc" }, { position: "asc" }],
      include: { version: { select: { versionName: true, versionNumber: true, status: true } } },
    }),
    db.competency.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  if (!question) notFound();

  const sectionOptions: SectionOption[] = sections.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    status: s.version.status,
    versionName: s.version.versionName,
    versionNumber: s.version.versionNumber,
  }));

  const isDraft = question.section.version.status === "DRAFT";
  const initial: QuestionDraft = draftFromQuestion({
    id: question.id,
    sectionId: question.sectionId,
    type: question.type,
    prompt: question.prompt,
    stimulus: question.stimulus,
    stimulusSvg: question.stimulusSvg,
    difficulty: question.difficulty,
    active: question.active,
    position: question.position,
    options: question.options.map((o) => ({
      text: o.text,
      isCorrect: o.isCorrect,
      score: o.score,
      mapJson: o.mapJson,
    })),
    itemsJson: question.itemsJson,
    competencies: question.competencies.map((c) => ({
      competency: { code: c.competency.code },
      weight: c.weight,
    })),
  });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/questions"
          className="text-sm font-semibold text-brand-600 hover:underline"
        >
          &larr; Question bank
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Edit question</h1>
        <p className="text-sm text-slate-500">
          {question.section.code} · {question.section.name} · v
          {question.section.version.versionNumber}
        </p>
      </div>

      {!isDraft ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This question belongs to a <strong>published</strong> version, which is
          immutable. Duplicate the version from{" "}
          <Link href="/admin/versions" className="font-semibold underline">
            Versions &amp; Links
          </Link>{" "}
          to make edits.
        </div>
      ) : null}

      <QuestionForm sections={sectionOptions} competencies={competencies} initial={initial} />
    </div>
  );
}
