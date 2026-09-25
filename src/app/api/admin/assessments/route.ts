import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { HttpError, parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { VERSION_STATUS, ROLES } from "@/lib/constants";
import { z } from "zod";

const createSchema = z.object({
  assessmentVersionId: z.string().min(1),
  title: z.string().trim().min(2).max(140),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "Use lowercase letters, numbers and dashes only")
    .optional(),
});

export const GET = withApi(async () => {
  await requireSession();
  const assessments = await db.assessment.findMany({
    orderBy: { createdAt: "desc" },
    include: { version: true, _count: { select: { attempts: true } } },
  });
  return NextResponse.json({ assessments });
});

/** Generate a public assessment link from a published version (PRD §51). */
export const POST = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = createSchema.parse(await parseJson(req));

  const version = await db.assessmentVersion.findUnique({
    where: { id: body.assessmentVersionId },
  });
  if (!version) throw new HttpError(400, "Unknown version");
  if (version.status !== VERSION_STATUS.PUBLISHED) {
    throw new HttpError(409, "Only published versions can be shared with candidates");
  }

  const token = body.slug ?? crypto.randomBytes(6).toString("hex");
  const clash = await db.assessment.findUnique({ where: { token } });
  if (clash) throw new HttpError(409, "That link is already in use. Pick another.");

  const assessment = await db.assessment.create({
    data: {
      token,
      title: body.title,
      assessmentVersionId: version.id,
    },
  });

  await logAudit({
    userId: session.id,
    action: "ASSESSMENT_LINK_CREATED",
    entity: "Assessment",
    entityId: assessment.id,
    meta: { token },
    ip: req.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ assessment }, { status: 201 });
});
