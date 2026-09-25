"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const emptyForm = {
  courseCode: "",
  courseName: "",
  description: "",
  careerFamily: "",
  ctaUrl: "",
  progression: "",
  minimumScore: 65,
  active: true,
  displayOrder: 0,
};

export interface CourseRow {
  id: string;
  courseCode: string;
  courseName: string;
  description: string | null;
  careerFamily: string | null;
  ctaUrl: string | null;
  progression: string[];
  minimumScore: number;
  active: boolean;
  displayOrder: number;
  weightCount: number;
}

export default function CoursesClient({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    courseCode: string;
    courseName: string;
    description: string;
    careerFamily: string;
    ctaUrl: string;
    progression: string;
    minimumScore: number;
    active: boolean;
    displayOrder: number;
  } | null>(null);

  function startEdit(c: CourseRow) {
    setCreating(false);
    setEditing(c.id);
    setError(null);
    setForm({
      courseCode: c.courseCode,
      courseName: c.courseName,
      description: c.description ?? "",
      careerFamily: c.careerFamily ?? "",
      ctaUrl: c.ctaUrl ?? "",
      progression: c.progression.join("\n"),
      minimumScore: c.minimumScore,
      active: c.active,
      displayOrder: c.displayOrder,
    });
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setError(null);
    setForm({ ...emptyForm });
  }

  async function create() {
    if (!form) return;
    setBusy("new");
    setError(null);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: form.courseCode.trim().toLowerCase(),
          courseName: form.courseName.trim(),
          description: form.description.trim() || null,
          careerFamily: form.careerFamily.trim() || null,
          ctaUrl: form.ctaUrl.trim() || null,
          progression: form.progression.split("\n").map((s) => s.trim()).filter(Boolean),
          minimumScore: Number(form.minimumScore),
          active: form.active,
          displayOrder: Number(form.displayOrder),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the course");
        return;
      }
      setCreating(false);
      setForm(null);
      router.refresh();
    } catch {
      setError("Network error - course not created");
    } finally {
      setBusy(null);
    }
  }

  async function save(id: string) {
    if (!form) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: form.courseName.trim(),
          description: form.description.trim() || null,
          careerFamily: form.careerFamily.trim() || null,
          ctaUrl: form.ctaUrl.trim() || null,
          progression: form.progression
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          minimumScore: Number(form.minimumScore),
          active: form.active,
          displayOrder: Number(form.displayOrder),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save the course");
        return;
      }
      setEditing(null);
      setForm(null);
      router.refresh();
    } catch {
      setError("Network error - not saved");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Manage course pathways, CTAs, thresholds and learning journeys.</p>
        <button className="btn btn-primary" onClick={creating ? () => { setCreating(false); setForm(null); } : startCreate}>
          {creating ? "Cancel new course" : "Add course"}
        </button>
      </div>

      {creating && form ? (
        <section className="card space-y-3 border-brand-200 bg-brand-50/40 p-5">
          <h2 className="font-bold">Create a course pathway</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Course code</label>
              <input className="input font-mono" value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="cloud_engineering" required />
            </div>
            <div>
              <label className="label">Course name</label>
              <input className="input" value={form.courseName} onChange={(e) => setForm({ ...form, courseName: e.target.value })} required />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Career family</label>
              <input className="input" value={form.careerFamily} onChange={(e) => setForm({ ...form, careerFamily: e.target.value })} />
            </div>
            <div>
              <label className="label">CTA URL</label>
              <input className="input" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} placeholder="/courses/cloud-engineering" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Minimum score</label>
              <input type="number" min={0} max={100} className="input" value={form.minimumScore} onChange={(e) => setForm({ ...form, minimumScore: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Display order</label>
              <input type="number" min={0} className="input" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
          </div>
          <div>
            <label className="label">Learning journey (one step per line)</label>
            <textarea className="input" rows={3} value={form.progression} onChange={(e) => setForm({ ...form, progression: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={create} disabled={busy === "new"}>
            {busy === "new" ? "Creating…" : "Create course"}
          </button>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {courses.map((c) => (
          <section key={c.id} className="card p-5">
            {editing === c.id && form ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Course name</label>
                    <input
                      className="input"
                      value={form.courseName}
                      onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Career family</label>
                    <input
                      className="input"
                      value={form.careerFamily}
                      onChange={(e) => setForm({ ...form, careerFamily: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">CTA URL</label>
                    <input
                      className="input"
                      value={form.ctaUrl}
                      onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                      placeholder="/courses/backend"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Min score</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="input"
                        value={form.minimumScore}
                        onChange={(e) =>
                          setForm({ ...form, minimumScore: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Order</label>
                      <input
                        type="number"
                        min={0}
                        className="input"
                        value={form.displayOrder}
                        onChange={(e) =>
                          setForm({ ...form, displayOrder: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label">
                    Learning journey (one step per line)
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.progression}
                    onChange={(e) => setForm({ ...form, progression: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    Active (included in scoring)
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary"
                    disabled={busy === c.id}
                    onClick={() => save(c.id)}
                  >
                    {busy === c.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditing(null);
                      setForm(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{c.courseName}</h2>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      {c.courseCode}
                    </span>
                    {!c.active ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        INACTIVE
                      </span>
                    ) : null}
                  </div>
                  {c.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {c.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    {c.careerFamily ? `${c.careerFamily} · ` : ""}
                    min {c.minimumScore} · {c.weightCount} competency weights ·{" "}
                    {c.progression.length} journey steps
                  </p>
                </div>
                <button className="btn btn-secondary !min-h-0 !py-1.5 !px-3 text-xs" onClick={() => startEdit(c)}>
                  Edit
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
