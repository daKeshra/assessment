import Link from "next/link";
import QuestionForm, {
  type QuestionDraft,
  type SectionOption,
} from "@/components/admin/QuestionForm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "New question | Africinnovate Admin" };

export default async function NewQuestionPage() {
  const [sections, competencies] = await Promise.all([
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

  const sectionOptions: SectionOption[] = sections.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    status: s.version.status,
    versionName: s.version.versionName,
    versionNumber: s.version.versionNumber,
  }));

  const initial: QuestionDraft = {
    sectionId: sections[0]?.id ?? "",
    type: "MULTIPLE_CHOICE",
    prompt: "",
    stimulus: null,
    stimulusSvg: null,
    difficulty: 2,
    active: true,
    position: 0,
    options: [],
    items: [],
    comps: [],
  };

  if (sections.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight">New question</h1>
        <div className="card p-6 text-sm text-slate-600">
          No draft sections exist yet. Published versions are immutable - duplicate a
          version into a draft (or create a new one) from{" "}
          <Link href="/admin/versions" className="font-semibold text-brand-600 underline">
            Versions &amp; Links
          </Link>{" "}
          first.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/questions"
          className="text-sm font-semibold text-brand-600 hover:underline"
        >
          &larr; Question bank
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">New question</h1>
        <p className="text-sm text-slate-500">
          Only draft sections are listed. Options, competency tags and the answer key
          stay admin-side - candidates never receive them.
        </p>
      </div>
      <QuestionForm
        sections={sectionOptions}
        competencies={competencies}
        initial={{ ...initial, options: [] }}
      />
    </div>
  );
}
