import { notFound } from "next/navigation";
import IntroForm from "@/components/assessment/IntroForm";
import { allowBackOf, durationMinutesOf, timerModeOf } from "@/lib/attempt";
import { db } from "@/lib/db";
import { getAllSettings } from "@/lib/settings";
import { TIMER_MODE_LABELS, VERSION_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function IntroPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const assessment = await db.assessment.findUnique({
    where: { token },
    include: {
      version: {
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: { questions: { where: { active: true } } },
          },
        },
      },
    },
  });

  if (!assessment || assessment.status !== "ACTIVE" || assessment.version.status !== VERSION_STATUS.PUBLISHED) {
    notFound();
  }

  const settings = await getAllSettings();
  const questionCount = assessment.version.sections.reduce((n, s) => n + s.questions.length, 0);

  return (
    <IntroForm
      assessmentToken={token}
      title={assessment.title}
      versionLabel={`${assessment.version.versionName} - Version ${assessment.version.versionNumber}`}
      questionCount={questionCount}
      sections={assessment.version.sections.map((s) => ({
        code: s.code,
        name: s.name,
        description: s.description,
        count: s.questions.length,
      }))}
      timer={{
        mode: timerModeOf(settings),
        modeLabel: TIMER_MODE_LABELS[timerModeOf(settings)] ?? "Timer",
        minutes: durationMinutesOf(settings),
      }}
      allowBack={allowBackOf(settings)}
    />
  );
}
