"use client";

import { useMemo } from "react";
import type { EngineQuestion } from "@/lib/attempt";

export interface AnswerValue {
  selectedOptionIds: string[];
  textResponse: string | null;
}

interface Props {
  question: EngineQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function Stimulus({ question }: { question: EngineQuestion }) {
  if (question.stimulus) {
    return (
      <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-mono text-slate-700 leading-relaxed">
        {question.stimulus}
      </pre>
    );
  }
  if (question.stimulusSvg) {
    return (
      // SVG comes from staff, rendered as an image so scripts cannot execute (PRD §37).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={svgDataUri(question.stimulusSvg)}
        alt={question.prompt}
        className="mb-4 w-full rounded-lg border border-slate-200 bg-white"
      />
    );
  }
  return null;
}

export default function QuestionRenderer({ question, value, onChange }: Props) {
  const isMulti = question.type === "MULTIPLE_SELECT";
  const selected = value.selectedOptionIds;

  const toggle = (id: string) => {
    if (isMulti) {
      const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      onChange({ ...value, selectedOptionIds: next });
    } else {
      onChange({ ...value, selectedOptionIds: [id] });
    }
  };

  if (question.type === "OPEN_ENDED") {
    return (
      <div>
        <Stimulus question={question} />
        <label className="label" htmlFor={`q-${question.id}`}>
          Your answer
        </label>
        <textarea
          id={`q-${question.id}`}
          className="input min-h-40"
          placeholder="Type your answer in your own words..."
          value={value.textResponse ?? ""}
          onChange={(e) => onChange({ ...value, textResponse: e.target.value, selectedOptionIds: [] })}
        />
        <p className="mt-1 text-xs text-slate-500">
          This answer is reviewed by an assessor using a clear rubric - write naturally.
        </p>
      </div>
    );
  }

  if (question.type === "ORDERING") {
    const items = question.items ?? [];
    const orderedIds = selected.length === items.length ? selected : items.map((i) => i.id);
    const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

    const move = (index: number, delta: number) => {
      const next = [...orderedIds];
      const target = index + delta;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      onChange({ ...value, selectedOptionIds: next });
    };

    return (
      <div>
        <Stimulus question={question} />
        <ol className="space-y-2">
          {orderedIds.map((id, index) => (
            <li
              key={id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                {index + 1}
              </span>
              <span className="flex-1 text-sm">{byId.get(id)?.text ?? id}</span>
              <span className="flex gap-1 no-print">
                <button
                  type="button"
                  aria-label={`Move "${byId.get(id)?.text}" up`}
                  className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  &uarr;
                </button>
                <button
                  type="button"
                  aria-label={`Move "${byId.get(id)?.text}" down`}
                  className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  disabled={index === orderedIds.length - 1}
                  onClick={() => move(index, 1)}
                >
                  &darr;
                </button>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          Use the arrow buttons to place every step in order, first at the top.
        </p>
      </div>
    );
  }

  if (question.type === "LIKERT") {
    return (
      <div>
        <Stimulus question={question} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr>
                <th />
                {question.options.map((o) => (
                  <th
                    key={o.id}
                    className="p-1 text-[11px] font-semibold text-slate-500 text-center align-bottom"
                  >
                    {o.text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-3 text-sm text-slate-500">Choose one:</td>
                {question.options.map((o) => {
                  const active = selected[0] === o.id;
                  return (
                    <td key={o.id} className="p-1 text-center">
                      <label
                        className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-semibold ${
                          active
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-slate-300 bg-white text-slate-600 hover:border-brand-300"
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`q-${question.id}`}
                          checked={active}
                          onChange={() => toggle(o.id)}
                          aria-label={o.text}
                        />
                        {question.options.indexOf(o) + 1}
                      </label>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          1 = {question.options[0]?.text ?? "Strongly disagree"} &middot; 5 ={" "}
          {question.options[4]?.text ?? "Strongly agree"}
        </p>
      </div>
    );
  }

  // MULTIPLE_CHOICE | VISUAL | SCENARIO
  return (
    <div>
      <Stimulus question={question} />
      {isMulti ? (
        <p className="mb-2 text-xs font-semibold text-brand-600">Select all that apply</p>
      ) : null}
      <div className="space-y-2" role="group" aria-label="Answer options">
        {question.options.map((o, index) => {
          const active = selected.includes(o.id);
          return (
            <label
              key={o.id}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                active
                  ? "border-brand-600 bg-brand-50"
                  : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50"
              }`}
            >
              <input
                type={isMulti ? "checkbox" : "radio"}
                className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
                name={`q-${question.id}`}
                checked={active}
                onChange={() => toggle(o.id)}
              />
              <span className="text-sm leading-relaxed text-slate-800">
                <span className="mr-2 font-bold text-slate-400">
                  {String.fromCharCode(65 + index)}.
                </span>
                {o.text}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Shared empty answer shape. */
export const emptyAnswer: AnswerValue = { selectedOptionIds: [], textResponse: null };

export function hasAnswered(v: AnswerValue | undefined): boolean {
  if (!v) return false;
  return v.selectedOptionIds.length > 0 || (v.textResponse ?? "").trim().length > 0;
}
