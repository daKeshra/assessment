"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VersionBadge } from "@/components/admin/badges";
import SectionsManager, { type SectionRow, type SectionVersion } from "@/components/admin/SectionsManager";

interface VersionRow {
  id: string;
  versionName: string;
  versionNumber: string;
  status: string;
  notes: string | null;
  questionCount: number;
  sectionCount: number;
  attemptCount: number;
}

interface LinkRow {
  token: string;
  title: string;
  status: string;
  versionNumber: string;
  attemptCount: number;
}

function Banner({ kind, text }: { kind: "ok" | "err"; text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl px-4 py-3 text-sm ${
        kind === "ok"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {text}
    </div>
  );
}

export default function VersionsClient({
  versions,
  links,
  publishedVersions,
  sectionVersions,
  sectionsByVersion,
}: {
  versions: VersionRow[];
  links: LinkRow[];
  publishedVersions: VersionRow[];
  sectionVersions: SectionVersion[];
  sectionsByVersion: Record<string, SectionRow[]>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [showLink, setShowLink] = useState(false);
  const [linkVersionId, setLinkVersionId] = useState(publishedVersions[0]?.id ?? "");
  const [linkTitle, setLinkTitle] = useState("Technology Career Aptitude Assessment");
  const [linkSlug, setLinkSlug] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function call(key: string, url: string, method: string, body?: unknown) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error ?? "Action failed" });
        return false;
      }
      return true;
    } catch {
      setMessage({ kind: "err", text: "Network error" });
      return false;
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  async function createVersion(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call("create", "/api/admin/versions", "POST", {
      versionName: name.trim(),
      versionNumber: number.trim(),
      notes: notes.trim() || undefined,
    });
    if (ok) {
      setMessage({ kind: "ok", text: `Version ${number} created as a draft.` });
      setShowCreate(false);
      setName("");
      setNumber("");
      setNotes("");
    }
  }

  async function duplicate(id: string) {
    const ok = await call(`dup-${id}`, `/api/admin/versions/${id}/duplicate`, "POST");
    if (ok)
      setMessage({
        kind: "ok",
        text: "Duplicated into a new draft - edit it, then publish when ready.",
      });
  }

  async function publish(id: string) {
    const ok = await call(`pub-${id}`, `/api/admin/versions/${id}/publish`, "POST");
    if (ok)
      setMessage({
        kind: "ok",
        text: "Published. This version is now immutable and can be shared.",
      });
  }

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call("link", "/api/admin/assessments", "POST", {
      assessmentVersionId: linkVersionId,
      title: linkTitle.trim(),
      slug: linkSlug.trim() || undefined,
    });
    if (ok) {
      setMessage({ kind: "ok", text: "Public link created." });
      setShowLink(false);
      setLinkSlug("");
    }
  }

  async function setLinkStatus(token: string, status: string) {
    if (
      status === "CLOSED" &&
      !window.confirm(
        "Close this assessment link? New candidates will not be able to open it. You can reopen it later.",
      )
    ) {
      return;
    }
    const ok = await call(`status-${token}`, `/api/admin/assessments/${token}`, "PATCH", { status });
    if (ok) {
      const label = status === "ACTIVE" ? "active" : status.toLowerCase();
      const detail =
        status === "ACTIVE"
          ? "Candidates can open the link again."
          : status === "PAUSED"
            ? "New attempts are paused."
            : "The public link is closed and returns 404 until reopened.";
      setMessage({
        kind: "ok",
        text: `Link /a/${token} is now ${label}. ${detail}`,
      });
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/a/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="space-y-5">
      {message ? <Banner kind={message.kind} text={message.text} /> : null}

      {/* versions */}
      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-bold">Assessment versions</h2>
            <p className="text-xs text-slate-500">
              Published versions are immutable - duplicate to edit (PRD §51).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? "Cancel" : "New draft version"}
            </button>
            <button
              className="btn btn-primary"
              disabled={publishedVersions.length === 0}
              onClick={() => setShowLink((v) => !v)}
              title={
                publishedVersions.length === 0
                  ? "Publish a version first"
                  : "Generate a shareable candidate link"
              }
            >
              Generate public link
            </button>
          </div>
        </div>

        {showCreate ? (
          <form
            onSubmit={createVersion}
            className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 md:grid-cols-4"
          >
            <div>
              <label className="label">Version name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Technology Aptitude"
                required
              />
            </div>
            <div>
              <label className="label">Version number</label>
              <input
                className="input"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="1.1"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes (internal)</label>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What changed in this version?"
              />
            </div>
            <div className="md:col-span-4">
              <button className="btn btn-primary" disabled={busy === "create"}>
                {busy === "create" ? "Creating…" : "Create draft"}
              </button>
            </div>
          </form>
        ) : null}

        <table className="table-base">
          <thead>
            <tr>
              <th>Version</th>
              <th>Status</th>
              <th>Sections</th>
              <th>Questions</th>
              <th>Attempts</th>
              <th>Links</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td>
                  <p className="font-semibold">
                    {v.versionName} <span className="text-slate-400">v{v.versionNumber}</span>
                  </p>
                  {v.notes ? (
                    <p className="text-xs text-slate-500">{v.notes}</p>
                  ) : null}
                </td>
                <td>
                  <VersionBadge status={v.status} />
                </td>
                <td>{v.sectionCount}</td>
                <td>{v.questionCount}</td>
                <td>{v.attemptCount}</td>
                <td>
                  {links.filter((l) => l.versionNumber === v.versionNumber).length}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {v.status === "DRAFT" ? (
                      <button
                        className="text-sm font-semibold text-brand-600 hover:underline disabled:opacity-40"
                        disabled={busy === `pub-${v.id}`}
                        onClick={() => publish(v.id)}
                      >
                        {busy === `pub-${v.id}` ? "Publishing…" : "Publish"}
                      </button>
                    ) : (
                      <button
                        className="text-sm font-semibold text-brand-600 hover:underline disabled:opacity-40"
                        disabled={busy === `dup-${v.id}`}
                        onClick={() => duplicate(v.id)}
                        title="Create an editable draft copy"
                      >
                        {busy === `dup-${v.id}` ? "Duplicating…" : "Duplicate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SectionsManager
        versions={sectionVersions}
        initialSections={sectionsByVersion}
      />

      {/* public links */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="font-bold">Public assessment links</h2>
            <p className="text-xs text-slate-500">
              Share these with candidates. Pause stops new attempts; existing ones can
              still resume.
            </p>
          </div>
          {showLink ? (
            <button className="btn btn-secondary" onClick={() => setShowLink(false)}>
              Cancel
            </button>
          ) : null}
        </div>

        {showLink ? (
          <form
            onSubmit={createLink}
            className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 md:grid-cols-4"
          >
            <div>
              <label className="label">Version</label>
              <select
                className="input"
                value={linkVersionId}
                onChange={(e) => setLinkVersionId(e.target.value)}
              >
                {publishedVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.versionName} v{v.versionNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Link title</label>
              <input
                className="input"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Custom slug (optional)</label>
              <input
                className="input"
                value={linkSlug}
                onChange={(e) => setLinkSlug(e.target.value)}
                placeholder="spring-2026"
                pattern="[a-z0-9-]{3,40}"
              />
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary w-full" disabled={busy === "link"}>
                {busy === "link" ? "Creating…" : "Create link"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="divide-y divide-slate-100">
          {links.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No public links yet. Publish a version, then generate a link.
            </p>
          ) : (
            links.map((l) => (
              <div
                key={l.token}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.title}</p>
                  <p className="truncate font-mono text-xs text-slate-500">
                    /a/{l.token} · v{l.versionNumber} · {l.attemptCount} attempts
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    l.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800"
                      : l.status === "PAUSED"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {l.status}
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn btn-secondary !min-h-0 !py-1.5 !px-3 text-xs"
                    onClick={() => copyLink(l.token)}
                  >
                    {copied === l.token ? "Copied!" : "Copy link"}
                  </button>
                  {l.status === "ACTIVE" ? (
                    <a
                      href={`/a/${l.token}`}
                      target="_blank"
                      className="btn btn-secondary !min-h-0 !py-1.5 !px-3 text-xs"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="px-1 text-xs text-slate-500">
                      Unavailable while {l.status.toLowerCase()}
                    </span>
                  )}
                  {l.status !== "ACTIVE" ? (
                    <button
                      className="btn btn-secondary !min-h-0 !py-1.5 !px-3 text-xs"
                      disabled={busy === `status-${l.token}`}
                      onClick={() => setLinkStatus(l.token, "ACTIVE")}
                    >
                      {l.status === "CLOSED" ? "Reopen" : "Activate"}
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary !min-h-0 !py-1.5 !px-3 text-xs"
                      disabled={busy === `status-${l.token}`}
                      onClick={() => setLinkStatus(l.token, "PAUSED")}
                    >
                      Pause
                    </button>
                  )}
                  {l.status !== "CLOSED" ? (
                    <button
                      className="btn btn-danger !min-h-0 !py-1.5 !px-3 text-xs"
                      disabled={busy === `status-${l.token}`}
                      onClick={() => setLinkStatus(l.token, "CLOSED")}
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
