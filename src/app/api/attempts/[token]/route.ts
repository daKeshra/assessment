import { NextRequest, NextResponse } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { buildEnginePayload, loadAttempt } from "@/lib/attempt";
import { ATTEMPT_STATUS } from "@/lib/constants";
import { getAllSettings } from "@/lib/settings";

/** Full (whitelisted) assessment state for the question engine. */
export const GET = withApi<{ token: string }>(async (req: NextRequest, { params }) => {
  const { token } = await params;
  const attempt = await loadAttempt(token);
  if (!attempt) throw new HttpError(404, "Assessment attempt not found");

  if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
    return NextResponse.json({
      completed: true,
      status: attempt.status,
      reportUrl: `/report/${attempt.token}`,
    });
  }

  const settings = await getAllSettings();
  return NextResponse.json(buildEnginePayload(attempt, settings));
});
