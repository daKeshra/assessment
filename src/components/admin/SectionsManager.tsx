"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface SectionRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  component: string;
  weight: number;
  position: number;
  questionCount: number;
}

export interface SectionVersion {
  id: string;
  versionName: string;
  versionNumber: string;
}

type Draft = {
  code: string;
  name: string;
  description: string;
  component: string;
  weight: number;
  position: number;
};

const emptyDraft: Draft = {
  code: "",
  name: "",
  description: "",
  component: "COGNITIVE",
  weight: 0,
  position: 1,
};

const componentLabels: Record<string, string> = {
  COGNITIVE: "Cognitive aptitude",
  SIMULATION: "Practical simulation",
  BEHAVIOUR: "Behaviour",
  INTEREST: "Interest",
  MOTIVATION: "Motivation",
};

export default function SectionsManager({
  versions,
  initialSections,
}: {
  versions: SectionVersion[];
  initialSections: Record<string, SectionRow[]>;
}) {
  const router = useRouter();
  const [selectedVersionId, setSelectedVersionId] = useState(versions[0]?.id ?? "");
  const [sectionsByVersion, setSectionsByVersion] = useState(initialSections);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSections = sectionsByVersion[selectedVersionId] ?? [];

  async function loadSections(versionId: string) {
    if (!versionId) return;
    try {
      const res = await fetch(`/api/admin/sections?versionId=${encodeURIComponent(versionId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load sections");
      setSectionsByVersion((current) => ({
        ...current,
        [versionId]: (data.sections as (SectionRow & { _count: { questions: number } })[]).map(
          (section) => ({
            ...section,
            questionCount: section._count.questions,
          }),
        ),
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load sections");
    }
  }

  useEffect(() => {
    void loadSections(selectedVersionId);
  }, [selectedVersionId]);

  function startCreate() {
    setEditingId(null);
    setDraft({ ...emptyDraft, position: selectedSections.length + 1 });
    setError(null);
    setShowForm(true);
  }

  function startEdit(section: SectionRow) {
    setEditingId(section.id);
    setDraft({
      code: section.code,
      name: section.name,
      description: section.description ?? "",
      component: section.component,
      weight: section.weight,
      position: section.position,
    });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    if (!selectedVersionId) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...draft,
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        weight: Number(draft.weight),
        position: Number(draft.position),
        ...(editingId ? {} : { assessmentVersionId: selectedVersionId }),
      };
      const res = await fetch(
        editingId ? `/api/admin/sections/${editingId}` : "/api/admin/sections",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save the section");
        return;
      }
      setShowForm(false);
      setEditingId(null);
      await loadSections(selectedVersionId);
      router.refresh();
    } catch {
      setError("Network error - section not saved");
    } finally {
      setBusy(false);
    }
  }

  async function remove(section: SectionRow) {
    if (section.questionCount > 0) {
      setError("Delete the section's questions before removing the section.");
      return;
    }
    if (!window.confirm(`Remove section ${section.code}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sections/${section.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not remove the section");
        return;
      }
      await loadSections(selectedVersionId);
      router.refresh();
    } catch {
      setError("Network error - section not removed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Assessment sections</h2>
          <p className="text-xs text-slate-500">Sections are editable only inside draft versions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto min-w-52" value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)}>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.versionName} v{version.versionNumber}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={startCreate} disabled={!selectedVersionId}>Add section</button>
        </div>
      </div>

      {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {showForm ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4 md:grid-cols-3">
          <div>
            <label className="label">Code</label>
            <input className="input font-mono" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} maxLength={5} disabled={editingId != null} />
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Component</label>
            <select className="input" value={draft.component} onChange={(e) => setDraft({ ...draft, component: e.target.value })}>
              {Object.entries(componentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Position</label>
            <input type="number" min={0} max={99} className="input" value={draft.position} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Component weight</label>
            <input type="number" min={0} max={100} step="0.1" className="input" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editingId ? "Save section" : "Create section"}</button>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Code</th><th>Name</th><th>Component</th><th>Weight</th><th>Position</th><th>Questions</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {selectedSections.map((section) => (
              <tr key={section.id}>
                <td className="font-mono font-semibold">{section.code}</td>
                <td>{section.name}</td>
                <td>{componentLabels[section.component] ?? section.component}</td>
                <td>{section.weight}</td>
                <td>{section.position}</td>
                <td>{section.questionCount}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => startEdit(section)}>Edit</button>
                    <button className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-40" onClick={() => remove(section)} disabled={busy || section.questionCount > 0}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {selectedSections.length === 0 ? <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-500">No sections in this version.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
