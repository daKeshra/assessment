"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import {
  AGE_RANGES,
  EDUCATION_LEVELS,
  HOURS_PER_WEEK,
  LEARNING_FORMATS,
  OCCUPATIONS,
  TECH_EXPOSURE,
} from "@/lib/constants";

interface Props {
  assessmentToken: string;
  title: string;
  versionLabel: string;
  questionCount: number;
  sections: { code: string; name: string; description: string | null; count: number }[];
  timer: { mode: string; modeLabel: string; minutes: number };
  allowBack: boolean;
}

const select = (list: string[], placeholder: string) => (
  <>
    <option value="">{placeholder}</option>
    {list.map((v) => (
      <option key={v} value={v}>
        {v}
      </option>
    ))}
  </>
);

export default function IntroForm(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    educationLevel: "",
    occupation: "",
    ageRange: "",
    techExposure: "",
    hoursPerWeek: "",
    preferredFormat: "",
    consent: false,
  });

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch(`/api/public/assessments/${props.assessmentToken}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.issues)) {
          const errs: Record<string, string> = {};
          for (const issue of data.issues) {
            if (!errs[issue.path]) errs[issue.path] = issue.message;
          }
          setFieldErrors(errs);
          setError(data.error ?? "Please check the highlighted fields.");
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        setBusy(false);
        return;
      }
      // Persist the resume token locally as a fallback (PRD §50)
      try {
        localStorage.setItem(`africinnovate_attempt_${props.assessmentToken}`, data.attemptToken);
      } catch {
        /* storage unavailable */
      }
      router.push(`/assess/${data.attemptToken}`);
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  const err = (key: string) => fieldErrors[key] && <p className="text-xs text-rose-600 mt-1">{fieldErrors[key]}</p>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-auto" />
          </div>
          <span className="text-xs text-slate-500">{props.versionLabel}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Left: information */}
          <section>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{props.title}</h1>
            <p className="mt-3 text-slate-600 leading-relaxed">
              This assessment finds out how you think, solve problems and work - so we can suggest
              the technology learning pathway where you are most likely to do well. It is designed
              for complete beginners: <strong>no programming or tech background is needed</strong>.
            </p>

            <div className="card mt-6 p-5">
              <h2 className="font-semibold">What to expect</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-brand-600 font-bold">&bull;</span>
                  {props.questionCount} questions in {props.sections.length} short sections
                  (reasoning, patterns, scenarios, visual checks and interests).
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-600 font-bold">&bull;</span>
                  {props.timer.mode === "NONE"
                    ? "No timer - take the time you need."
                    : `${props.timer.modeLabel}: ${props.timer.minutes} minutes.`}
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-600 font-bold">&bull;</span>
                  Your answers save automatically. If your connection drops or you close this page,
                  use the same link and email to continue where you stopped.
                </li>
                <li className="flex gap-2">
                  <span className="text-brand-600 font-bold">&bull;</span>
                  {props.allowBack
                    ? "You can move back and forth between questions and review before submitting."
                    : "You cannot return to a previous question once you move on - take your time on each one."}
                </li>
              </ul>

              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Focus</th>
                      <th className="text-right">Questions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.sections.map((s) => (
                      <tr key={s.code}>
                        <td className="font-semibold">{s.code}</td>
                        <td>{s.name}</td>
                        <td className="text-right">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed">
              This assessment provides an <strong>aptitude-based learning recommendation</strong>.
              It does not determine your ability, does not guarantee success in a particular career,
              and is not a psychological or IQ test. Your interests, effort and environment also
              matter.
            </div>
          </section>

          {/* Right: registration */}
          <section className="card p-6 h-fit">
            <h2 className="font-bold text-lg">Candidate information</h2>
            <p className="text-xs text-slate-500 mt-1">
              Required fields are marked *. We use this to link your result and contact you about
              your recommendation.
            </p>

            <form onSubmit={start} className="mt-5 space-y-4" noValidate>
              <div>
                <label className="label" htmlFor="fullName">
                  Full name *
                </label>
                <input
                  id="fullName"
                  className="input"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  autoComplete="name"
                  required
                />
                {err("fullName")}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="email">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    autoComplete="email"
                    required
                  />
                  {err("email")}
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    Phone number *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    className="input"
                    placeholder="0803 000 0000"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    autoComplete="tel"
                    required
                  />
                  {err("phone")}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="educationLevel">
                  Education level *
                </label>
                <select
                  id="educationLevel"
                  className="input"
                  value={form.educationLevel}
                  onChange={(e) => set("educationLevel", e.target.value)}
                  required
                >
                  {select(EDUCATION_LEVELS, "Select...")}
                </select>
                {err("educationLevel")}
              </div>

              <div>
                <label className="label" htmlFor="occupation">
                  Current status / occupation *
                </label>
                <select
                  id="occupation"
                  className="input"
                  value={form.occupation}
                  onChange={(e) => set("occupation", e.target.value)}
                  required
                >
                  {select(OCCUPATIONS, "Select...")}
                </select>
                {err("occupation")}
              </div>

              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600">
                  Optional details (helps your recommendation)
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="label" htmlFor="ageRange">
                      Age range
                    </label>
                    <select
                      id="ageRange"
                      className="input"
                      value={form.ageRange}
                      onChange={(e) => set("ageRange", e.target.value)}
                    >
                      {select(AGE_RANGES, "Prefer not to say")}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="techExposure">
                      Previous technology exposure
                    </label>
                    <select
                      id="techExposure"
                      className="input"
                      value={form.techExposure}
                      onChange={(e) => set("techExposure", e.target.value)}
                    >
                      {select(TECH_EXPOSURE, "Select...")}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="hoursPerWeek">
                      Hours available per week
                    </label>
                    <select
                      id="hoursPerWeek"
                      className="input"
                      value={form.hoursPerWeek}
                      onChange={(e) => set("hoursPerWeek", e.target.value)}
                    >
                      {select(HOURS_PER_WEEK, "Select...")}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="preferredFormat">
                      Preferred learning format
                    </label>
                    <select
                      id="preferredFormat"
                      className="input"
                      value={form.preferredFormat}
                      onChange={(e) => set("preferredFormat", e.target.value)}
                    >
                      {select(LEARNING_FORMATS, "Select...")}
                    </select>
                  </div>
                </div>
              </details>

              <label className="flex gap-3 items-start text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-brand-600"
                  checked={form.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                />
                <span>
                  I consent to Africinnovate processing my information and assessment responses to
                  produce my technology pathway recommendation. Staff may use an AI-assisted rubric
                  suggestion for written answers; it is advisory and subject to human review. I
                  understand the result is an aptitude-based suggestion, not a guarantee. *
                </span>
              </label>
              {err("consent")}

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button type="submit" className="btn btn-primary w-full py-3" disabled={busy}>
                {busy ? "Preparing your assessment..." : "Start the assessment"}
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                Already started? Enter the same email above - we will resume your attempt.
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
