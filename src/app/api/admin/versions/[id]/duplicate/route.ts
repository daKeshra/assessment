import { NextRequest, NextResponse } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";

async function loadVersion(id: string) {
  const version = await db.assessmentVersion.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          questions: {
            orderBy: { position: "asc" },
            include: {
              options: { orderBy: { position: "asc" } },
              competencies: true,
            },
          },
        },
      },
    },
  });
  if (!version) throw new HttpError(404, "Version not found");
  return version;
}

/**
 * Duplicate a version into a new draft (PRD §51: published versions are
 * immutable - edit by duplicating).
 */
export const POST = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;
  const source = await loadVersion(id);

  const base = parseFloat(source.versionNumber) || 1;
  const nextNumber = `${Math.floor(base)}.${(Math.round(base * 10) % 10) + 1}`;

  const copy = await db.$transaction(async (tx) => {
    const version = await tx.assessmentVersion.create({
      data: {
        versionName: `${source.versionName} (copy)`,
        versionNumber: nextNumber,
        notes: source.notes,
        status: VERSION_STATUS.DRAFT,
      },
    });

    for (const section of source.sections) {
      const newSection = await tx.section.create({
        data: {
          assessmentVersionId: version.id,
          code: section.code,
          name: section.name,
          description: section.description,
          component: section.component,
          weight: section.weight,
          position: section.position,
        },
      });

      for (const q of section.questions) {
        const created = await tx.question.create({
          data: {
            sectionId: newSection.id,
            position: q.position,
            type: q.type,
            prompt: q.prompt,
            stimulus: q.stimulus,
            stimulusSvg: q.stimulusSvg,
            difficulty: q.difficulty,
            active: q.active,
            itemsJson: q.itemsJson,
            requiresManualScore: q.requiresManualScore,
          },
        });
        if (q.options.length > 0) {
          await tx.questionOption.createMany({
            data: q.options.map((o) => ({
              questionId: created.id,
              text: o.text,
              position: o.position,
              isCorrect: o.isCorrect,
              score: o.score,
              mapJson: o.mapJson,
            })),
          });
        }
        if (q.competencies.length > 0) {
          await tx.questionCompetency.createMany({
            data: q.competencies.map((c) => ({
              questionId: created.id,
              competencyId: c.competencyId,
              weight: c.weight,
            })),
          });
        }
      }
    }
    return version;
  });

  await logAudit({
    userId: session.id,
    action: "VERSION_DUPLICATED",
    entity: "AssessmentVersion",
    entityId: copy.id,
    meta: { from: source.id, versionNumber: nextNumber },
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ version: copy }, { status: 201 });
});
