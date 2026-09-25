import { NextRequest, NextResponse } from "next/server";
import { HttpError, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { canExport } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";

/**
 * CSV export of candidate results (PRD §47).
 * Columns: identity, version, scores, recommendations, all competencies, all courses.
 */
export const GET = withApi(async (req: NextRequest) => {
  const session = await requireSession();
  if (!canExport(session.role)) throw new HttpError(403, "Export not permitted for your role");

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const courseCode = url.searchParams.get("course");
  const confidence = url.searchParams.get("confidence");
  const versionId = url.searchParams.get("version");
  const status = url.searchParams.get("status");

  const competencies = await db.competency.findMany({ orderBy: { code: "asc" } });
  const courses = await db.course.findMany({ orderBy: { displayOrder: "asc" } });

  const attempts = await db.attempt.findMany({
    where: {
      startTime: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(`${to}T23:59:59`) : undefined,
      },
      status: status && status !== "ALL" ? status : undefined,
      assessmentVersionId: versionId && versionId !== "ALL" ? versionId : undefined,
      recommendation:
        courseCode && courseCode !== "ALL"
          ? { primaryCourse: { courseCode } }
          : undefined,
      AND:
        confidence && confidence !== "ALL"
          ? [{ recommendation: { confidence } }]
          : undefined,
    },
    include: {
      candidate: true,
      version: true,
      recommendation: { include: { primaryCourse: true } },
      report: true,
      competencyScores: true,
      courseScores: { include: { course: true } },
    },
    orderBy: { startTime: "desc" },
    take: 5000,
  });

  const header = [
    "Candidate ID",
    "Name",
    "Email",
    "Phone",
    "Assessment date",
    "Assessment version",
    "Status",
    "Duration (minutes)",
    "Overall score",
    "Completeness",
    "Primary recommendation",
    "Secondary recommendation",
    "Profile",
    "Confidence",
    ...competencies.map((c) => `${c.name} (${c.code})`),
    ...courses.map((c) => c.courseName),
  ];

  const rows = attempts.map((a) => {
    const compByComp = Object.fromEntries(a.competencyScores.map((s) => [s.competencyId, s.score]));
    const courseByCode = Object.fromEntries(a.courseScores.map((s) => [s.course.courseCode, s.score]));
    const rec = a.recommendation;
    const secondaries = rec
      ? (JSON.parse(rec.secondaryCourseIds ?? "[]") as string[])
          .map((code) => courses.find((c) => c.courseCode === code)?.courseName ?? code)
          .join("; ")
      : "";

    return [
      a.candidate.id,
      a.candidate.fullName,
      a.candidate.email,
      a.candidate.phone,
      a.startTime.toISOString().slice(0, 10),
      `${a.version.versionName} v${a.version.versionNumber}`,
      a.status,
      a.durationSeconds ? Math.round(a.durationSeconds / 60) : "",
      a.report?.overallScore ?? "",
      a.report?.completeness != null ? Math.round(a.report.completeness * 100) + "%" : "",
      rec?.primaryCourse?.courseName ?? "Technology Explorer",
      secondaries,
      rec?.profileType ?? "",
      rec?.confidence ?? "",
      ...competencies.map((c) => compByComp[c.id] ?? ""),
      ...courses.map((c) => courseByCode[c.courseCode] ?? ""),
    ];
  });

  const csv = toCsv([header, ...rows]);
  return csvResponse(`africinnovate-assessments-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});
