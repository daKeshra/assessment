import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";
import { questionSchema } from "@/lib/validation";
import { validateAnswers } from "@/lib/question-validation";

async function loadQuestion(id: string) {
  const question = await db.question.findUnique({
    where: { id },
    include: { section: { include: { version: true } } },
  });
  if (!question) throw new HttpError(404, "Question not found");
  return question;
}

export const GET = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  await requireSession();
  const { id } = await params;
  const question = await db.question.findUnique({
    where: { id },
    include: {
      section: { include: { version: true } },
      options: { orderBy: { position: "asc" } },
      competencies: { include: { competency: true } },
    },
  });
  if (!question) throw new HttpError(404, "Question not found");
  return NextResponse.json({ question });
});

/** Update a question - only while its version is a draft. */
export const PATCH = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;
  const existing = await loadQuestion(id);

  if (existing.section.version.status !== VERSION_STATUS.DRAFT) {
    throw new HttpError(409, "Published versions are immutable. Duplicate the version first.", {
      code: "VERSION_IMMUTABLE",
      versionId: existing.section.version.id,
    });
  }

  const body = questionSchema.parse(await parseJson(req));
  validateAnswers(body.type, body.options, body.items?.length ?? 0);

  await db.$transaction(async (tx) => {
    const itemsJson = body.items
      ? JSON.stringify(
          body.items.map((text, i) => ({
            id: `item-${id}-${i + 1}`,
            text: text.text,
            correctPosition: i,
          })),
        )
      : existing.itemsJson;

    await tx.question.update({
      where: { id },
      data: {
        sectionId: body.sectionId,
        position: body.position,
        type: body.type,
        prompt: body.prompt,
        stimulus: body.stimulus ?? null,
        stimulusSvg: body.stimulusSvg ?? null,
        difficulty: body.difficulty,
        active: body.active,
        itemsJson,
        requiresManualScore: body.type === "OPEN_ENDED",
      },
    });

    await tx.questionOption.deleteMany({ where: { questionId: id } });
    await tx.questionOption.createMany({
      data: body.options.map((o) => ({
        questionId: id,
        text: o.text,
        position: o.position,
        isCorrect: o.isCorrect,
        score: o.score,
        mapJson: o.mapJson ?? null,
      })),
    });

    await tx.questionCompetency.deleteMany({ where: { questionId: id } });
    for (const c of body.competencies) {
      const comp = await tx.competency.findUnique({ where: { code: c.code } });
      if (!comp) continue;
      await tx.questionCompetency.create({
        data: { questionId: id, competencyId: comp.id, weight: c.weight },
      });
    }
  });

  await logAudit({
    userId: session.id,
    action: "QUESTION_UPDATED",
    entity: "Question",
    entityId: id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true });
});

/** Delete a question (draft versions only). */
export const DELETE = withApi<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireSession([ROLES.ADMIN]);
  const { id } = await params;
  const existing = await loadQuestion(id);

  if (existing.section.version.status !== VERSION_STATUS.DRAFT) {
    throw new HttpError(409, "Published versions are immutable. Duplicate the version first.", {
      code: "VERSION_IMMUTABLE",
    });
  }

  await db.question.delete({ where: { id } });

  await logAudit({
    userId: session.id,
    action: "QUESTION_DELETED",
    entity: "Question",
    entityId: id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true });
});
