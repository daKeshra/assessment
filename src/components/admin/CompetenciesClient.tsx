"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Competency {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  questionCount: number;
  courseWeightCount: number;
}

export default function CompetenciesClient({ items }: { items: Competency[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; active: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState({ code: "", name: "", description: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body: unknown, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return false;
      }
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : "New competency"}
        </button>
      </div>

      {showCreate ? (
        <form
          className="card grid gap-3 p-4 md:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await call(
              "/api/admin/competencies",
              "POST",
              {
                code: newItem.code.trim().toUpperCase(),
                name: newItem.name.trim(),
                description: newItem.description.trim() || null,
                active: true,
              },
              "create",
            );
            if (ok) {
              setShowCreate(false);
              setNewItem({ code: "", name: "", description: "" });
            }
          }}
        >
          <div>
            <label className="label">Code (2-4 chars)</label>
            <input
              className="input uppercase"
              maxLength={10}
              required
              value={newItem.code}
              onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
              placeholder="XY"
            />
          </div>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              required
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="Competency name"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button className="btn btn-primary w-full" disabled={busy === "create"}>
              {busy === "create" ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <section key={c.id} className="card p-4">
            {editing === c.id && form ? (
              <div className="space-y-3">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
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
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  Active
                </label>
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary"
                    disabled={busy === c.id}
                    onClick={async () => {
                      const ok = await call(
                        `/api/admin/competencies/${c.id}`,
                        "PATCH",
                        {
                          name: form.name.trim(),
                          description: form.description.trim() || null,
                          active: form.active,
                        },
                        c.id,
                      );
                      if (ok) {
                        setEditing(null);
                        setForm(null);
                      }
                    }}
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
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
                      {c.code}
                    </span>
                    <h2 className="truncate text-sm font-bold">{c.name}</h2>
                    {!c.active ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        OFF
                      </span>
                    ) : null}
                  </div>
                  {c.description ? (
                    <p className="mt-1 text-xs text-slate-500">{c.description}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {c.questionCount} question tags · {c.courseWeightCount} course weights
                  </p>
                </div>
                <button
                  className="text-xs font-semibold text-brand-600 hover:underline"
                  onClick={() => {
                    setEditing(c.id);
                    setForm({
                      name: c.name,
                      description: c.description ?? "",
                      active: c.active,
                    });
                  }}
                >
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
