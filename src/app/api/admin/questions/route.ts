import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";
import { questionSchema } from "@/lib/validation";
import { validateAnswers } from "@/lib/question-validation";

/** List questions with filters (admin/instructor). Never exposes attempts. */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  const url = new URL(req.url);
  const sectionId = url.searchParams.get("sectionId") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const active = url.searchParams.get("active");
  const versionId = url.searchParams.get("versionId") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const questions = await db.question.findMany({
    where: {
      sectionId,
      type,
      active: active === null || active === undefined ? undefined : active === "true",
      section: versionId ? { assessmentVersionId: versionId } : undefined,
      OR: q
        ? [{ prompt: { contains: q } }, { section: { name: { contains: q } } }]
        : undefined,
    },
    include: {
      section: { include: { version: true } },
      options: { orderBy: { position: "asc" } },
      competencies: { include: { competency: true } },
      _count: { select: { responses: true } },
    },
    orderBy: [{ section: { position: "asc" } }, { position: "asc" }],
    take: 500,
  });

  void session;
  return NextResponse.json({ questions });
});

/** Create a question. Only inside a DRAFT version (PRD §51). */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = questionSchema.parse(await parseJson(req));

  const section = await db.section.findUnique({
    where: { id: body.sectionId },
    include: { version: true },
  });
  if (!section) throw new HttpError(400, "Unknown section");
  if (section.version.status !== VERSION_STATUS.DRAFT) {
    throw new HttpError(409, "Published versions are immutable. Duplicate the version first.", {
      code: "VERSION_IMMUTABLE",
    });
  }

  validateAnswers(body.type, body.options, body.items?.length ?? 0);

  const question = await db.$transaction(async (tx) => {
    const itemsJson = body.items
      ? JSON.stringify(
          body.items.map((text, i) => ({
            id: `item-${Date.now()}-${i + 1}`,
            text: text.text,
            correctPosition: i,
          })),
        )
      : null;

    const created = await tx.question.create({
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

    await tx.questionOption.createMany({
      data: body.options.map((o) => ({
        questionId: created.id,
        text: o.text,
        position: o.position,
        isCorrect: o.isCorrect,
        score: o.score,
        mapJson: o.mapJson ?? null,
      })),
    });

    for (const c of body.competencies) {
      const comp = await tx.competency.findUnique({ where: { code: c.code } });
      if (!comp) continue;
      await tx.questionCompetency.create({
        data: { questionId: created.id, competencyId: comp.id, weight: c.weight },
      });
    }

    return created;
  });

  await logAudit({
    userId: session.id,
    action: "QUESTION_CREATED",
    entity: "Question",
    entityId: question.id,
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ question }, { status: 201 });
});
