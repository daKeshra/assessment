import AssessmentEngine from "@/components/assessment/AssessmentEngine";

export const dynamic = "force-dynamic";

export default async function AssessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AssessmentEngine attemptToken={token} />;
}
