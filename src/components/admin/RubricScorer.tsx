"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RUBRIC = [
  { value: 0, label: "0", desc: "No relevant response" },
  { value: 1, label: "1", desc: "Minimal / off-topic" },
  { value: 2, label: "2", desc: "Partial, some relevant ideas" },
  { value: 3, label: "3", desc: "Solid, mostly complete" },
  { value: 4, label: "4", desc: "Excellent, well structured" },
];

type AiSuggestion = {
  score: number;
  rationale: string;
  confidence: number;
  model: string;
};

export default function RubricScorer({
  responseId,
  current,
  aiScore,
  aiRationale,
  aiConfidence,
  aiModel,
}: {
  responseId: string;
  current: number | null;
  aiScore?: number | null;
  aiRationale?: string | null;
  aiConfidence?: number | null;
  aiModel?: string | null;
}) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(current);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(current != null);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(
    aiScore != null
      ? {
          score: aiScore,
          rationale: aiRationale ?? "",
          confidence: aiConfidence ?? 0,
          model: aiModel ?? "Saved suggestion",
        }
      : null,
  );

  async function save(next: number) {
    setScore(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/responses/${responseId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanScore: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save score");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error - score not saved");
    } finally {
      setBusy(false);
    }
  }

  async function requestAiSuggestion() {
    setAiBusy(true);
    setAiError(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/responses/${responseId}/ai-score`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "Could not generate an AI suggestion");
        return;
      }
      setSuggestion({
        score: Number(data.aiScore),
        rationale: String(data.aiRationale ?? ""),
        confidence: Number(data.aiConfidence ?? 0),
        model: String(data.model ?? "AI provider"),
      });
      router.refresh();
    } catch {
      setAiError("Network error - AI suggestion was not generated");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Rubric score
        </span>
        {RUBRIC.map((r) => (
          <button
            key={r.value}
            type="button"
            disabled={busy || aiBusy}
            title={r.desc}
            onClick={() => save(r.value)}
            className={`h-9 w-9 rounded-lg border text-sm font-bold transition disabled:opacity-50 ${
              score === r.value
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {busy
            ? "Saving..."
            : saved && score != null
              ? `Saved: ${score}/4 → ${Math.round((score / 4) * 100)}%`
              : "Not yet reviewed"}
        </span>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={requestAiSuggestion}
            disabled={aiBusy || busy}
            className="btn btn-secondary px-3 py-1.5 text-xs"
          >
            {aiBusy ? "Analysing response..." : "Suggest score with AI"}
          </button>
          <span className="text-[11px] text-slate-500">
            AI is advisory; a staff member must accept or replace the suggestion.
          </span>
        </div>

        {suggestion ? (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-sky-900">
                AI suggestion: {suggestion.score}/4 · {Math.round(suggestion.confidence * 100)}% confidence
              </p>
              {!saved && suggestion.score >= 0 && suggestion.score <= 4 ? (
                <button
                  type="button"
                  onClick={() => save(Math.round(suggestion.score))}
                  disabled={busy || aiBusy}
                  className="btn btn-primary px-3 py-1.5 text-xs"
                >
                  Accept as human score
                </button>
              ) : null}
            </div>
            {suggestion.rationale ? (
              <p className="mt-2 text-xs leading-relaxed text-sky-900">{suggestion.rationale}</p>
            ) : null}
            <p className="mt-2 text-[10px] text-sky-700">Model: {suggestion.model}</p>
          </div>
        ) : null}
        {aiError ? <p className="mt-2 text-xs text-rose-600">{aiError}</p> : null}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
