import { NextRequest } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { allowBackOf, timerModeOf, durationMinutesOf } from "@/lib/attempt";
import { getAllSettings } from "@/lib/settings";
import { VERSION_STATUS } from "@/lib/constants";

export const GET = withApi<{ token: string }>(async (req: NextRequest, { params }) => {
  const limit = rateLimit(`public:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) throw new HttpError(429, "Too many requests");

  const { token } = await params;
  const assessment = await db.assessment.findUnique({
    where: { token },
    include: {
      version: {
        include: {
          sections: { orderBy: { position: "asc" }, include: { questions: true } },
        },
      },
    },
  });

  if (!assessment || assessment.status !== "ACTIVE") {
    throw new HttpError(404, "This assessment link is not active. Check the link you were given.");
  }
  if (assessment.version.status !== VERSION_STATUS.PUBLISHED) {
    throw new HttpError(404, "This assessment version is not published yet.");
  }

  const settings = await getAllSettings();

  return Response.json({
    title: assessment.title,
    versionName: assessment.version.versionName,
    versionNumber: assessment.version.versionNumber,
    timer: { mode: timerModeOf(settings), minutes: durationMinutesOf(settings) },
    allowBack: allowBackOf(settings),
    questionCount: assessment.version.sections.reduce((n, s) => n + s.questions.length, 0),
    sections: assessment.version.sections.map((s) => ({
      code: s.code,
      name: s.name,
      description: s.description,
      questionCount: s.questions.length,
    })),
  });
});
