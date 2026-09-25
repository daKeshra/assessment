import { NextRequest, NextResponse } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { buildStudentReport } from "@/lib/report";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const GET = withApi<{ token: string }>(async (req: NextRequest, { params }) => {
  const limit = rateLimit(`report:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) throw new HttpError(429, "Too many requests");

  const { token } = await params;
  const report = await buildStudentReport(token);
  if (!report) {
    throw new HttpError(409, "This assessment has not been completed yet", {
      code: "NOT_COMPLETED",
    });
  }
  return NextResponse.json(report);
});
