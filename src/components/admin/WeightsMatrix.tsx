"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface WeightCourse {
  id: string;
  courseName: string;
  weights: Record<string, number>; // competencyId -> 0..5
}

export interface WeightCompetency {
  id: string;
  code: string;
  name: string;
}

type Matrix = Record<string, Record<string, number>>; // courseId -> compId -> w

export default function WeightsMatrix({
  courses,
  competencies,
}: {
  courses: WeightCourse[];
  competencies: WeightCompetency[];
}) {
  const router = useRouter();
  const initial = useMemo<Matrix>(() => {
    const m: Matrix = {};
    for (const c of courses) m[c.id] = { ...c.weights };
    return m;
  }, [courses]);

  const [matrix, setMatrix] = useState<Matrix>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty = JSON.stringify(matrix) !== JSON.stringify(initial);

  const changedCells = useMemo(() => {
    let n = 0;
    for (const c of courses) {
      for (const comp of competencies) {
        if ((matrix[c.id]?.[comp.id] ?? 0) !== (initial[c.id]?.[comp.id] ?? 0)) n++;
      }
    }
    return n;
  }, [matrix, initial, courses, competencies]);

  function setCell(courseId: string, compId: string, raw: number) {
    const w = Math.max(0, Math.min(5, Math.round(raw)));
    setMatrix((m) => ({
      ...m,
      [courseId]: { ...(m[courseId] ?? {}), [compId]: w },
    }));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights: matrix }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error ?? "Could not save weights" });
        return;
      }
      setMessage({
        kind: "ok",
        text: `Saved ${data.updated ?? changedCells} weight cells.`,
      });
      router.refresh();
    } catch {
      setMessage({ kind: "err", text: "Network error - weights not saved" });
    } finally {
      setBusy(false);
    }
  }

  const color = (w: number) => {
    if (w >= 5) return "bg-brand-600 text-white border-brand-600";
    if (w >= 4) return "bg-brand-500 text-white border-brand-500";
    if (w >= 3) return "bg-brand-100 text-brand-800 border-brand-200";
    if (w >= 1) return "bg-brand-50 text-brand-700 border-brand-100";
    if (w > 0) return "bg-slate-50 text-slate-600 border-slate-200";
    return "bg-white text-slate-300 border-slate-200";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Competency importance per course, 0-5 (PRD §19). Higher weight = that
          competency moves this course&apos;s fit score more.
        </p>
        <div className="flex items-center gap-3">
          {message ? (
            <span
              className={`text-sm font-semibold ${
                message.kind === "ok" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {message.text}
            </span>
          ) : null}
          {dirty ? (
            <span className="text-xs font-semibold text-amber-600">
              {changedCells} unsaved change{changedCells === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            className="btn btn-primary"
            disabled={!dirty || busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save weights"}
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50">Course \ Competency</th>
              {competencies.map((c) => (
                <th key={c.id} className="text-center" title={c.name}>
                  <div>{c.code}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="hover:bg-slate-50">
                <td className="sticky left-0 whitespace-nowrap bg-white font-medium">
                  {course.courseName}
                </td>
                {competencies.map((comp) => {
                  const value = matrix[course.id]?.[comp.id] ?? 0;
                  return (
                    <td key={comp.id} className="text-center">
                      <input
                        type="number"
                        min={0}
                        max={5}
                        aria-label={`${course.courseName} - ${comp.name}`}
                        title={`${course.courseName} × ${comp.name}`}
                        className={`h-9 w-12 rounded-md border text-center text-sm font-bold ${color(value)}`}
                        value={value}
                        onChange={(e) =>
                          setCell(course.id, comp.id, Number(e.target.value))
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span>
          <strong>0</strong> irrelevant
        </span>
        <span>
          <strong>3</strong> important
        </span>
        <span>
          <strong>5</strong> defining
        </span>
        <span>Changes affect future scoring runs only - existing reports keep their scores.</span>
      </div>
    </div>
  );
}
