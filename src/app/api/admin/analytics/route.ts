import { NextRequest, NextResponse } from "next/server";
import { withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getAssessmentAnalytics } from "@/lib/analytics-data";

/** Aggregated, non-identifying analytics for BI tools and staff dashboards. */
export const GET = withApi(async (req: NextRequest) => {
  await requireSession();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const version = url.searchParams.get("version");
  const course = url.searchParams.get("course");
  const confidence = url.searchParams.get("confidence");
  const status = url.searchParams.get("status");
  const { summary } = await getAssessmentAnalytics({
    from,
    to,
    versionId: version,
    courseCode: course,
    confidence,
    status,
  });
  return NextResponse.json({
    filters: { from, to, version, course, confidence, status },
    analytics: summary,
  });
});
