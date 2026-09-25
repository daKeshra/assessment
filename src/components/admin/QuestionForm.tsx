"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DIFFICULTY_LABELS,
  LIKERT_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
} from "@/lib/constants";

export interface SectionOption {
  id: string;
  code: string;
  name: string;
  status: string;
  versionName: string;
  versionNumber: string;
}

export interface CompetencyOption {
  code: string;
  name: string;
}

interface OptionDraft {
  key: string;
  text: string;
  isCorrect: boolean;
  score: number;
  mapJson: string;
}

export interface QuestionDraft {
  id?: string;
  sectionId: string;
  type: string;
  prompt: string;
  stimulus: string | null;
  stimulusSvg: string | null;
  difficulty: number;
  active: boolean;
  position: number;
  options: OptionDraft[];
  items: string[];
  comps: { code: string; weight: number }[];
}

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function defaultOptions(type: string): OptionDraft[] {
  const mk = (text: string, isCorrect: boolean, score: number): OptionDraft => ({
    key: newKey(),
    text,
    isCorrect,
    score,
    mapJson: "",
  });
  switch (type) {
    case "LIKERT":
      return LIKERT_LABELS.map((t, i) => mk(t, false, i + 1));
    case "SCENARIO":
      return [
        mk("Best response", true, 4),
        mk("Good response", false, 3),
        mk("Neutral response", false, 2),
        mk("Poor response", false, 1),
      ];
    case "MULTIPLE_SELECT":
      return [mk("", true, 0), mk("", true, 0), mk("", false, 0), mk("", false, 0)];
    case "OPEN_ENDED":
    case "ORDERING":
      return [];
    default: // MULTIPLE_CHOICE, VISUAL
      return [mk("", true, 0), mk("", false, 0), mk("", false, 0), mk("", false, 0)];
  }
}

export function draftFromQuestion(question: {
  id: string;
  sectionId: string;
  type: string;
  prompt: string;
  stimulus: string | null;
  stimulusSvg: string | null;
  difficulty: number;
  active: boolean;
  position: number;
  options: { text: string; isCorrect: boolean; score: number; mapJson: string | null }[];
  itemsJson: string | null;
  competencies: { competency: { code: string }; weight: number }[];
}): QuestionDraft {
  let items: string[] = [];
  if (question.itemsJson) {
    try {
      items = (
        JSON.parse(question.itemsJson) as { text: string; correctPosition: number }[]
      )
        .sort((a, b) => a.correctPosition - b.correctPosition)
        .map((i) => i.text);
    } catch {
      items = [];
    }
  }
  return {
    id: question.id,
    sectionId: question.sectionId,
    type: question.type,
    prompt: question.prompt,
    stimulus: question.stimulus,
    stimulusSvg: question.stimulusSvg,
    difficulty: question.difficulty,
    active: question.active,
    position: question.position,
    options: question.options.map((o) => ({
      key: newKey(),
      text: o.text,
      isCorrect: o.isCorrect,
      score: o.score,
      mapJson: o.mapJson ?? "",
    })),
    items,
    comps: question.competencies.map((c) => ({
      code: c.competency.code,
      weight: c.weight,
    })),
  };
}

const HINTS: Record<string, string> = {
  MULTIPLE_CHOICE: "Exactly one correct answer.",
  VISUAL: "Shown with the SVG stimulus. Exactly one correct answer.",
  MULTIPLE_SELECT: "At least two correct answers.",
  LIKERT: "Exactly five scale points (pre-filled).",
  SCENARIO: "Rate each response 0-4; one option must be scored 4 (best).",
  OPEN_ENDED: "Free text - scored later with the 0-4 rubric. No options needed.",
  ORDERING: "List the items in the CORRECT order (order defines the key).",
};

export default function QuestionForm({
  sections,
  competencies,
  initial,
}: {
  sections: SectionOption[];
  competencies: CompetencyOption[];
  initial: QuestionDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuestionDraft>(() => {
    const needs =
      !["OPEN_ENDED", "ORDERING"].includes(initial.type) && initial.options.length === 0;
    return needs ? { ...initial, options: defaultOptions(initial.type) } : initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const patch = (p: Partial<QuestionDraft>) => setDraft((d) => ({ ...d, ...p }));

  const needsOptions = !["OPEN_ENDED", "ORDERING"].includes(draft.type);

  function clientValidate(): string[] {
    const errs: string[] = [];
    if (!draft.sectionId) errs.push("Choose a section.");
    if (draft.prompt.trim().length < 2) errs.push("Prompt is required.");

    if (needsOptions) {
      const filled = draft.options.filter((o) => o.text.trim().length > 0);
      if (filled.length !== draft.options.length)
        errs.push("Every option needs text (or remove empty rows).");
      const correct = draft.options.filter((o) => o.isCorrect).length;
      if (draft.type === "LIKERT" && draft.options.length !== 5)
        errs.push("Likert needs exactly 5 options.");
      if (
        (draft.type === "MULTIPLE_CHOICE" || draft.type === "VISUAL") &&
        correct !== 1
      )
        errs.push("Mark exactly one correct answer.");
      if (draft.type === "MULTIPLE_SELECT" && correct < 2)
        errs.push("Mark at least two correct answers.");
      if (draft.type === "SCENARIO" && !draft.options.some((o) => o.score === 4))
        errs.push("One option must be scored 4 (best response).");
      draft.options.forEach((o, i) => {
        if (!o.mapJson.trim()) return;
        try {
          JSON.parse(o.mapJson);
        } catch {
          errs.push(`Option ${i + 1}: interest map is not valid JSON.`);
        }
      });
    }

    if (draft.type === "ORDERING") {
      const filled = draft.items.filter((t) => t.trim().length > 0);
      if (filled.length < 2) errs.push("Ordering needs at least two items.");
    }

    if (draft.comps.length === 0)
      errs.push("Tag at least one competency so scoring can attribute the answer.");
    draft.comps.forEach((c) => {
      if (!(c.weight >= 0.25 && c.weight <= 5))
        errs.push(`Competency ${c.code}: weight must be between 0.25 and 5.`);
    });
    return errs;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = clientValidate();
    setIssues(errs);
    setError(null);
    if (errs.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload = {
      sectionId: draft.sectionId,
      type: draft.type,
      prompt: draft.prompt.trim(),
      stimulus: draft.stimulus?.trim() || null,
      stimulusSvg: draft.stimulusSvg?.trim() || null,
      difficulty: Number(draft.difficulty),
      active: draft.active,
      position: Number(draft.position),
      items:
        draft.type === "ORDERING"
          ? draft.items
              .filter((t) => t.trim().length > 0)
              .map((text) => ({ text: text.trim() }))
          : undefined,
      options: needsOptions
        ? draft.options
            .filter((o) => o.text.trim().length > 0)
            .map((o, i) => ({
              text: o.text.trim(),
              position: i,
              isCorrect: draft.type === "SCENARIO" || draft.type === "LIKERT" ? false : o.isCorrect,
              score: Number(o.score),
              mapJson: o.mapJson.trim() ? o.mapJson.trim() : null,
            }))
        : [],
      competencies: draft.comps,
    };

    setBusy(true);
    try {
      const url = draft.id ? `/api/admin/questions/${draft.id}` : "/api/admin/questions";
      const res = await fetch(url, {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "VERSION_IMMUTABLE") {
          setError(
            "This question lives in a published (immutable) version. Duplicate the version into a draft first.",
          );
        } else if (Array.isArray(data.issues)) {
          setIssues(data.issues.map((i: { message: string }) => i.message));
        } else {
          setError(data.error ?? "Could not save the question.");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push("/admin/questions");
      router.refresh();
    } catch {
      setError("Network error - the question was not saved.");
    } finally {
      setBusy(false);
    }
  }

  function changeType(next: string) {
    const keepsText = ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "VISUAL"].includes(
      draft.type,
    ) && ["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "VISUAL"].includes(next);
    patch({
      type: next,
      options: keepsText ? draft.options.map((o, i) => ({
        ...o,
        isCorrect: next === "MULTIPLE_SELECT" ? i < 2 : i === 0,
        score: 0,
      })) : defaultOptions(next),
    });
  }

  const setOption = (key: string, p: Partial<OptionDraft>) =>
    patch({
      options: draft.options.map((o) => (o.key === key ? { ...o, ...p } : o)),
    });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {(error || issues.length > 0) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error ? <p className="font-semibold">{error}</p> : null}
          {issues.length > 0 ? (
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="card grid gap-4 p-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="section">
            Section (draft versions only)
          </label>
          <select
            id="section"
            className="input"
            value={draft.sectionId}
            onChange={(e) => patch({ sectionId: e.target.value })}
          >
            <option value="">Choose a section…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name} (v{s.versionNumber} {s.status.toLowerCase()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="type">
            Question type
          </label>
          <select
            id="type"
            className="input"
            value={draft.type}
            onChange={(e) => changeType(e.target.value)}
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{HINTS[draft.type]}</p>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            className="input"
            rows={3}
            value={draft.prompt}
            onChange={(e) => patch({ prompt: e.target.value })}
            placeholder="What is the candidate asked to do or answer?"
          />
        </div>
        <div>
          <label className="label" htmlFor="stimulus">
            Stimulus / context (optional)
          </label>
          <textarea
            id="stimulus"
            className="input"
            rows={3}
            value={draft.stimulus ?? ""}
            onChange={(e) => patch({ stimulus: e.target.value || null })}
            placeholder="Table, scenario text or data shown above the prompt"
          />
        </div>
        <div>
          <label className="label" htmlFor="stimulusSvg">
            SVG stimulus (optional, VISUAL questions)
          </label>
          <textarea
            id="stimulusSvg"
            className="input font-mono text-xs"
            rows={3}
            value={draft.stimulusSvg ?? ""}
            onChange={(e) => patch({ stimulusSvg: e.target.value || null })}
            placeholder="<svg …> … </svg>"
          />
        </div>
        <div>
          <label className="label" htmlFor="difficulty">
            Difficulty
          </label>
          <select
            id="difficulty"
            className="input"
            value={draft.difficulty}
            onChange={(e) => patch({ difficulty: Number(e.target.value) })}
          >
            {[1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d} - {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="position">
              Position
            </label>
            <input
              id="position"
              type="number"
              min={0}
              max={500}
              className="input"
              value={draft.position}
              onChange={(e) => patch({ position: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="active">
              Active
            </label>
            <select
              id="active"
              className="input"
              value={draft.active ? "true" : "false"}
              onChange={(e) => patch({ active: e.target.value === "true" })}
            >
              <option value="true">Active</option>
              <option value="false">Inactive (hidden)</option>
            </select>
          </div>
        </div>
      </div>

      {/* options */}
      {needsOptions ? (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Answer options</h2>
            <button
              type="button"
              className="btn btn-secondary !min-h-0 !py-1.5 !px-3 text-xs"
              onClick={() =>
                patch({
                  options: [
                    ...draft.options,
                    {
                      key: newKey(),
                      text: "",
                      isCorrect: draft.type === "MULTIPLE_SELECT",
                      score: 0,
                      mapJson: "",
                    },
                  ],
                })
              }
            >
              + Add option
            </button>
          </div>
          <div className="space-y-2">
            {draft.options.map((o) => (
              <div key={o.key} className="flex flex-wrap items-center gap-2">
                <input
                  type={
                    draft.type === "MULTIPLE_CHOICE" ||
                    draft.type === "MULTIPLE_SELECT" ||
                    draft.type === "VISUAL"
                      ? "radio"
                      : "checkbox"
                  }
                  name="correct"
                  className="h-4 w-4 accent-brand-600"
                  checked={draft.type === "SCENARIO" || draft.type === "LIKERT" ? false : o.isCorrect}
                  disabled={draft.type === "SCENARIO" || draft.type === "LIKERT"}
                  onChange={() => {
                    if (draft.type === "MULTIPLE_CHOICE" || draft.type === "VISUAL") {
                      patch({
                        options: draft.options.map((x) => ({
                          ...x,
                          isCorrect: x.key === o.key,
                        })),
                      });
                    } else {
                      setOption(o.key, { isCorrect: !o.isCorrect });
                    }
                  }}
                  title="Mark as correct"
                />
                <input
                  className="input flex-1 !min-h-9 !py-1.5"
                  value={o.text}
                  placeholder={`Option ${draft.options.indexOf(o) + 1}`}
                  onChange={(e) => setOption(o.key, { text: e.target.value })}
                />
                {(draft.type === "SCENARIO" || draft.type === "LIKERT") && (
                  <select
                    className="input !w-24 !min-h-9 !py-1.5"
                    value={o.score}
                    onChange={(e) => setOption(o.key, { score: Number(e.target.value) })}
                    title={draft.type === "SCENARIO" ? "Rubric score 0-4" : "Scale point"}
                  >
                    {(draft.type === "SCENARIO" ? [0, 1, 2, 3, 4] : [1, 2, 3, 4, 5]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ),
                    )}
                  </select>
                )}
                <input
                  className="input !w-40 !min-h-9 !py-1.5 font-mono text-xs"
                  value={o.mapJson}
                  placeholder='map {"courses":{…}}'
                  onChange={(e) => setOption(o.key, { mapJson: e.target.value })}
                  title='Optional JSON: {"courses":{"backend_development":90},"competencies":{"PS":2}}'
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700"
                  onClick={() =>
                    patch({ options: draft.options.filter((x) => x.key !== o.key) })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Check = correct (multiple choice / multi-select / visual). Scenario and
            Likert use the score column instead. The map column is optional JSON for
            course interest or extra competency weight.
          </p>
        </section>
      ) : null}

      {/* ordering items */}
      {draft.type === "ORDERING" ? (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Items in correct order</h2>
            <button
              type="button"
              className="btn btn-secondary !min-h-0 !py-1.5 !px-3 text-xs"
              onClick={() => patch({ items: [...draft.items, ""] })}
            >
              + Add item
            </button>
          </div>
          <div className="space-y-2">
            {draft.items.map((text, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-bold text-slate-400">
                  {i + 1}
                </span>
                <input
                  className="input flex-1 !min-h-9 !py-1.5"
                  value={text}
                  onChange={(e) =>
                    patch({
                      items: draft.items.map((t, idx) =>
                        idx === i ? e.target.value : t,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  disabled={i === 0}
                  onClick={() =>
                    patch({
                      items: draft.items.map((t, idx) =>
                        idx === i - 1 ? draft.items[i] : idx === i ? draft.items[i - 1] : t,
                      ),
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  disabled={i === draft.items.length - 1}
                  onClick={() =>
                    patch({
                      items: draft.items.map((t, idx) =>
                        idx === i + 1 ? draft.items[i] : idx === i ? draft.items[i + 1] : t,
                      ),
                    })
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700"
                  onClick={() => patch({ items: draft.items.filter((_, idx) => idx !== i) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The candidate sees these shuffled; this order is the answer key.
          </p>
        </section>
      ) : null}

      {/* competencies */}
      <section className="card p-5">
        <h2 className="mb-1 font-bold">Competency tags</h2>
        <p className="mb-3 text-xs text-slate-500">
          Weights 0.25-5 drive competency scoring. At least one tag is required.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {competencies.map((c) => {
            const current = draft.comps.find((x) => x.code === c.code);
            return (
              <div
                key={c.code}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  current ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={!!current}
                  onChange={() =>
                    patch({
                      comps: current
                        ? draft.comps.filter((x) => x.code !== c.code)
                        : [...draft.comps, { code: c.code, weight: 1 }],
                    })
                  }
                />
                <span className="flex-1 truncate" title={c.name}>
                  <strong>{c.code}</strong> {c.name}
                </span>
                {current ? (
                  <input
                    type="number"
                    min={0.25}
                    max={5}
                    step={0.25}
                    className="input !w-16 !min-h-8 !py-1 text-center"
                    value={current.weight}
                    onChange={(e) =>
                      patch({
                        comps: draft.comps.map((x) =>
                          x.code === c.code ? { ...x, weight: Number(e.target.value) } : x,
                        ),
                      })
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : draft.id ? "Save changes" : "Create question"}
        </button>
        <Link href="/admin/questions" className="btn btn-secondary">
          Cancel
        </Link>
        <span className="text-xs text-slate-500">
          Saved questions appear in draft versions until published.
        </span>
      </div>
    </form>
  );
}

