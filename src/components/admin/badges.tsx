/** Small shared status badges used across the admin UI. */

const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-emerald-100 text-emerald-800",
  TIMED_OUT: "bg-orange-100 text-orange-800",
  ABANDONED: "bg-slate-200 text-slate-600",
};

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  TIMED_OUT: "Timed out",
  ABANDONED: "Abandoned",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        STATUS_STYLES[status] ?? "bg-slate-200 text-slate-600"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: "bg-emerald-100 text-emerald-800",
  MODERATE: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-200 text-slate-600",
};

export function ConfidenceBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        CONFIDENCE_STYLES[value] ?? "bg-slate-200 text-slate-600"
      }`}
    >
      {value} confidence
    </span>
  );
}

const PROFILE_STYLES: Record<string, string> = {
  SINGLE: "bg-brand-100 text-brand-700",
  MULTI_PATH: "bg-sky-100 text-sky-800",
  EXPLORER: "bg-violet-100 text-violet-800",
};

const PROFILE_LABELS: Record<string, string> = {
  SINGLE: "Single pathway",
  MULTI_PATH: "Multi-path",
  EXPLORER: "Explorer",
};

export function ProfileBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        PROFILE_STYLES[value] ?? "bg-slate-200 text-slate-600"
      }`}
    >
      {PROFILE_LABELS[value] ?? value}
    </span>
  );
}

const VERSION_STYLES: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-slate-200 text-slate-600",
};

export function VersionBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        VERSION_STYLES[status] ?? "bg-slate-200 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

/** Horizontal score bar (0..100) with an optional threshold marker. */
export function ScoreBar({
  value,
  threshold,
  color = "bg-brand-500",
}: {
  value: number;
  threshold?: number;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      {threshold != null && threshold > 0 && threshold < 100 ? (
        <span
          className="absolute top-0 h-full w-px bg-slate-400"
          style={{ left: `${threshold}%` }}
          title={`Threshold ${threshold}`}
        />
      ) : null}
    </div>
  );
}
