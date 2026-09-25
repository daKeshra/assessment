import VersionsClient from "@/components/admin/VersionsClient";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Versions & Links | Africinnovate Admin" };

export default async function VersionsPage() {
  const [versions, assessments] = await Promise.all([
    db.assessmentVersion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sections: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            component: true,
            weight: true,
            position: true,
            questions: { select: { id: true } },
          },
        },
        _count: { select: { attempts: true, assessments: true } },
      },
    }),
    db.assessment.findMany({
      orderBy: { createdAt: "desc" },
      include: { version: { select: { versionNumber: true } }, _count: { select: { attempts: true } } },
    }),
  ]);

  const rows = versions.map((v) => ({
    id: v.id,
    versionName: v.versionName,
    versionNumber: v.versionNumber,
    status: v.status,
    notes: v.notes,
    sectionCount: v.sections.length,
    questionCount: v.sections.reduce((n, s) => n + s.questions.length, 0),
    attemptCount: v._count.attempts,
  }));

  const linkRows = assessments.map((a) => ({
    token: a.token,
    title: a.title,
    status: a.status,
    versionNumber: a.version.versionNumber,
    attemptCount: a._count.attempts,
  }));

  const sectionVersions = rows.filter((row) => row.status === "DRAFT").map((row) => ({
    id: row.id,
    versionName: row.versionName,
    versionNumber: row.versionNumber,
  }));
  const sectionsByVersion = Object.fromEntries(
    versions.map((version) => [
      version.id,
      version.sections.map((section) => ({
        id: section.id,
        code: section.code,
        name: section.name,
        description: section.description,
        component: section.component,
        weight: section.weight,
        position: section.position,
        questionCount: section.questions.length,
      })),
    ]),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Versions &amp; Links</h1>
        <p className="text-sm text-slate-500">
          Versioned content, immutability and the shareable candidate links.
        </p>
      </div>
      <VersionsClient
        versions={rows}
        links={linkRows}
        publishedVersions={rows.filter((r) => r.status === "PUBLISHED")}
        sectionVersions={sectionVersions}
        sectionsByVersion={sectionsByVersion}
      />
    </div>
  );
}
