"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingRow {
  key: string;
  value: string;
  group: string;
  label: string;
  type: string;
  options: string | null;
}

const GROUP_ORDER = ["thresholds", "scoring", "assessment", "anti-cheat"];
const GROUP_TITLES: Record<string, string> = {
  thresholds: "Recommendation thresholds",
  scoring: "Component weights",
  assessment: "Assessment & timer",
  "anti-cheat": "Randomisation & integrity",
  general: "General",
};
const GROUP_BLURBS: Record<string, string> = {
  thresholds: "When a course is recommended and how confident the result is (PRD §24).",
  scoring: "Share of the final 100-point score per component (should total 100).",
  assessment: "Timer mode, duration and navigation rules for candidates.",
  "anti-cheat": "Shuffling and the flags raised on suspicious timing.",
};

export default function SettingsForm({ settings }: { settings: SettingRow[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const changed = settings.filter((s) => values[s.key] !== s.value);
  const groups = [...new Set(settings.map((s) => s.group))].sort(
    (a, b) =>
      (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99),
  );

  const weightSum = settings
    .filter((s) => s.key.startsWith("w_"))
    .reduce((n, s) => n + (Number(values[s.key]) || 0), 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const payload: Record<string, string> = {};
      for (const s of changed) payload[s.key] = values[s.key];
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error ?? "Could not save settings" });
        return;
      }
      setMessage({
        kind: "ok",
        text: `Saved ${Object.keys(data.applied ?? payload).length} setting(s). New submissions use these values; existing reports keep their scores.`,
      });
      router.refresh();
    } catch {
      setMessage({ kind: "err", text: "Network error - settings not saved" });
    } finally {
      setBusy(false);
    }
  }

  function control(s: SettingRow) {
    const value = values[s.key];
    const set = (v: string) => setValues((prev) => ({ ...prev, [s.key]: v }));
    if (s.type === "boolean") {
      return (
        <button
          type="button"
          role="switch"
          aria-checked={value === "true"}
          onClick={() => set(value === "true" ? "false" : "true")}
          className={`relative h-7 w-12 rounded-full transition ${
            value === "true" ? "bg-brand-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
              value === "true" ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      );
    }
    if (s.type === "select") {
      return (
        <select className="input !w-44" value={value} onChange={(e) => set(e.target.value)}>
          {(s.options ?? "").split(",").map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="number"
        className="input !w-32 text-right"
        value={value}
        step="any"
        onChange={(e) => set(e.target.value)}
      />
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {message ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          All scoring and recommendation logic is driven by these values - no rules are
          hard-coded.
        </p>
        <div className="flex items-center gap-3">
          {changed.length > 0 ? (
            <span className="text-xs font-semibold text-amber-600">
              {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || changed.length === 0}
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g} className="card p-5">
            <h2 className="font-bold">{GROUP_TITLES[g] ?? g}</h2>
            <p className="mb-4 text-xs text-slate-500">{GROUP_BLURBS[g]}</p>
            <div className="space-y-3">
              {settings
                .filter((s) => s.group === g)
                .map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <label className="text-sm font-medium" htmlFor={`set-${s.key}`}>
                        {s.label}
                      </label>
                      <p className="font-mono text-[10px] text-slate-400">{s.key}</p>
                    </div>
                    <div className="shrink-0">{control(s)}</div>
                  </div>
                ))}
            </div>
            {g === "scoring" ? (
              <p
                className={`mt-3 text-xs font-semibold ${
                  Math.abs(weightSum - 100) < 0.01 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                Component weights total: {weightSum}
                {Math.abs(weightSum - 100) < 0.01
                  ? " ✓"
                  : " - should equal 100"}
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </form>
  );
}
