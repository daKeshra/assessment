"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import QuestionRenderer, {
  emptyAnswer,
  hasAnswered,
  type AnswerValue,
} from "@/components/assessment/QuestionRenderer";

interface EngineSection {
  id: string;
  code: string;
  name: string;
  description: string | null;
  component: string;
  questionIds: string[];
}

interface EngineQuestion {
  id: string;
  sectionId: string;
  type: string;
  prompt: string;
  stimulus: string | null;
  stimulusSvg: string | null;
  requiresManualScore: boolean;
  options: { id: string; text: string }[];
  items: { id: string; text: string }[] | null;
}

interface EngineData {
  attempt: { token: string; status: string; serverNow: string };
  candidate: { fullName: string };
  config: {
    timerMode: string;
    durationMinutes: number;
    allowBack: boolean;
    sectionCount: number;
    totalQuestions: number;
    answeredCount: number;
    sectionAllotmentSeconds: number | null;
    sectionStarts: Record<string, number>;
  };
  sections: EngineSection[];
  questions: EngineQuestion[];
  responses: Record<string, { selectedOptionIds: string[]; textResponse: string | null }>;
  currentIndex: number;
  remainingSeconds: number | null;
}

function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function AssessmentEngine({ attemptToken }: { attemptToken: string }) {
  const router = useRouter();
  const [data, setData] = useState<EngineData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [sectionLeft, setSectionLeft] = useState<number | null>(null);
  const [sectionExpired, setSectionExpired] = useState(false);
  const [review, setReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sectionStartsRef = useRef<Record<string, number>>({});
  const enteredAtRef = useRef<number>(Date.now());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitRef = useRef(false);
  const submitRef = useRef<(timedOut: boolean) => Promise<void>>(async () => {});
  const pendingKey = `africinnovate_pending_${attemptToken}`;

  const flat = useMemo(() => data?.questions ?? [], [data]);
  const sectionByQuestion = useMemo(() => {
    const map = new Map<string, EngineSection>();
    for (const s of data?.sections ?? []) for (const qid of s.questionIds) map.set(qid, s);
    return map;
  }, [data]);

  const current = flat[index];
  const currentSection = current ? sectionByQuestion.get(current.id) : undefined;

  const answeredSet = useMemo(() => {
    const set = new Set<string>();
    for (const [qid, v] of Object.entries(answers)) if (hasAnswered(v)) set.add(qid);
    return set;
  }, [answers]);

  // ------------------------------------------------------------------ load
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attempts/${attemptToken}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        setLoadError(payload.error ?? "Unable to load the assessment.");
        return;
      }
      if (payload.completed) {
        router.replace(payload.reportUrl);
        return;
      }
      const initial: Record<string, AnswerValue> = {};
      for (const [qid, v] of Object.entries(
        payload.responses as Record<string, { selectedOptionIds: string[]; textResponse: string | null }>,
      )) {
        initial[qid] = { selectedOptionIds: v.selectedOptionIds, textResponse: v.textResponse };
      }
      setData(payload);
      setAnswers(initial);
      setIndex(payload.currentIndex ?? 0);
      setTimeLeft(payload.remainingSeconds);
      sectionStartsRef.current = { ...(payload.config.sectionStarts ?? {}) };
      enteredAtRef.current = Date.now();
      autoSubmitRef.current = false;
      setSaveState("saved");
    } catch {
      setLoadError("Network error while loading your assessment. Check your connection and reload.");
    }
  }, [attemptToken, router]);

  useEffect(() => {
    load();
  }, [load]);

  // ------------------------------------------------------- flush saved work
  const flushPending = useCallback(async () => {
    try {
      const raw = localStorage.getItem(pendingKey);
      if (!raw) return;
      const bodies = JSON.parse(raw) as unknown[];
      for (const body of bodies) {
        await fetch(`/api/attempts/${attemptToken}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      localStorage.removeItem(pendingKey);
      setSaveState("saved");
    } catch {
      /* still offline - keep queued */
    }
  }, [attemptToken, pendingKey]);

  useEffect(() => {
    void flushPending();
    const onOnline = () => void flushPending();
    window.addEventListener("online", onOnline);
    const interval = setInterval(() => {
      if (navigator.onLine) void flushPending();
    }, 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [flushPending]);

  // ----------------------------------------------------------------- save
  const doSave = useCallback(
    async (qIndex: number) => {
      if (!data) return;
      const q = flat[qIndex];
      if (!q) return;
      const value = answers[q.id] ?? emptyAnswer;
      const spent = Math.max(0, Math.round(Date.now() - enteredAtRef.current));
      enteredAtRef.current = Date.now();
      const section = sectionByQuestion.get(q.id);

      const body = {
        questionId: q.id,
        selectedOptionIds: value.selectedOptionIds,
        textResponse: value.textResponse,
        timeSpentMs: spent,
        currentQuestionId: q.id,
        ...(section ? { sectionId: section.id, sectionView: true } : {}),
      };

      setSaveState("saving");
      try {
        const res = await fetch(`/api/attempts/${attemptToken}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const out = await res.json();
        if (res.ok) {
          setSaveState("saved");
          if (out.sectionStarts) sectionStartsRef.current = out.sectionStarts;
          if (typeof out.remainingSeconds === "number") setTimeLeft(out.remainingSeconds);
          if (section && !(section.id in sectionStartsRef.current)) {
            sectionStartsRef.current[section.id] = Date.now();
          }
          setSectionExpired(false);
          return;
        }
        if (out.code === "TIME_EXPIRED") {
          void submitRef.current(true);
          return;
        }
        if (out.code === "SECTION_EXPIRED") {
          setSectionExpired(true);
          return;
        }
        if (out.code === "ALREADY_SUBMITTED") {
          router.replace(out.reportUrl);
          return;
        }
        throw new Error("save failed");
      } catch {
        // offline/failed -> queue locally and retry (PRD §41)
        setSaveState("offline");
        try {
          const raw = localStorage.getItem(pendingKey);
          const list = raw ? (JSON.parse(raw) as unknown[]) : [];
          list.push(body);
          localStorage.setItem(pendingKey, JSON.stringify(list.slice(-100)));
        } catch {
          /* storage unavailable */
        }
      }
    },
    [answers, attemptToken, data, flat, pendingKey, router, sectionByQuestion],
  );

  // debounced autosave while answering
  const scheduleSave = useCallback(
    (qIndex: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => void doSave(qIndex), 400);
    },
    [doSave],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  // ---------------------------------------------------------------- submit
  const submit = useCallback(
    async (timedOut: boolean) => {
      if (autoSubmitRef.current && !timedOut) return;
      autoSubmitRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      try {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        await doSave(index);
        const res = await fetch(`/api/attempts/${attemptToken}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timedOut }),
        });
        const out = await res.json();
        if (res.ok) {
          try {
            localStorage.removeItem(pendingKey);
          } catch {
            /* ignore */
          }
          router.replace(out.reportUrl);
          return;
        }
        autoSubmitRef.current = false;
        setSubmitting(false);
        setSubmitError(out.error ?? "Submission failed. Please try again.");
      } catch {
        autoSubmitRef.current = false;
        setSubmitting(false);
        setSubmitError("Network error while submitting. Check your connection and try again.");
      }
    },
    [attemptToken, doSave, index, pendingKey, router],
  );

  submitRef.current = submit;

  // ------------------------------------------------------------- timers
  useEffect(() => {
    if (!data) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return prev;
        const next = Math.max(0, prev - 1);
        if (next === 0 && !autoSubmitRef.current) void submitRef.current(true);
        return next;
      });

      if (data.config.timerMode === "SECTION" && currentSection) {
        const start = sectionStartsRef.current[currentSection.id];
        const allot = data.config.sectionAllotmentSeconds;
        if (start && allot) {
          const left = Math.max(0, Math.round(allot - (Date.now() - start) / 1000));
          setSectionLeft(left);
          if (left === 0) setSectionExpired(true);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [data, currentSection]);

  // ------------------------------------------------------------ navigation
  const goTo = useCallback(
    (next: number) => {
      if (!data) return;
      if (next < 0 || next >= flat.length) return;
      if (!data.config.allowBack && next < index) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      void doSave(index);
      setIndex(next);
      enteredAtRef.current = Date.now();
      setSectionExpired(false);
      // touching the new section starts its server-side timer on first save
      const q = flat[next];
      const section = q ? sectionByQuestion.get(q.id) : undefined;
      if (section && data.config.timerMode === "SECTION") {
        if (!(section.id in sectionStartsRef.current)) {
          sectionStartsRef.current[section.id] = Date.now();
          setSectionLeft(data.config.sectionAllotmentSeconds);
        }
        void doSave(next);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [data, doSave, flat, index, sectionByQuestion],
  );

  // ---------------------------------------------------------------- views
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="font-bold text-lg">Assessment unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <a href="/" className="btn btn-secondary mt-5">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  if (!data || !current) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading your assessment...
      </div>
    );
  }

  const sectionNumber = currentSection
    ? data.sections.findIndex((s) => s.id === currentSection.id) + 1
    : 1;
  const questionNumber = index + 1;
  const progressPct = Math.round((questionNumber / flat.length) * 100);
  const isFirstInSection =
    !currentSection || currentSection.questionIds[0] === current.id || index === 0;
  const prevAllowed = data.config.allowBack && index > 0;
  const isLast = index === flat.length - 1;
  const unanswered = flat.filter((q) => !answeredSet.has(q.id));

  const nextSectionIndex = (() => {
    if (!currentSection) return -1;
    const pos = data.sections.findIndex((s) => s.id === currentSection.id);
    for (let i = pos + 1; i < data.sections.length; i++) {
      const first = data.sections[i].questionIds[0];
      const idx = flat.findIndex((q) => q.id === first);
      if (idx >= 0) return idx;
    }
    return -1;
  })();

  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 no-print">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo className="h-7 w-auto shrink-0" priority="lazy" />
            <span className="hidden sm:block font-bold text-sm truncate">
              {data.candidate.fullName}&apos;s assessment
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium ${
                saveState === "offline" ? "text-rose-600" : "text-slate-500"
              }`}
              aria-live="polite"
            >
              {saveState === "saving" && "Saving..."}
              {saveState === "saved" && "All answers saved"}
              {saveState === "offline" && "Offline - answers stored, will sync"}
              {saveState === "idle" && ""}
            </span>

            {timeLeft !== null ? (
              <div
                className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
                  timeLeft < 300
                    ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-700"
                }`}
                role="timer"
                aria-label="Time remaining"
              >
                Time remaining: {fmt(timeLeft)}
              </div>
            ) : null}
          </div>
        </div>

        {/* progress */}
        <div className="mx-auto max-w-4xl px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5 gap-2">
            <span>
              Section {sectionNumber} of {data.config.sectionCount}
            </span>
            <span>
              Question {questionNumber} of {flat.length}
            </span>
            <span className="font-semibold">{progressPct}% complete</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="text-xs font-semibold text-brand-600 hover:underline"
              onClick={() => setReview(true)}
            >
              Review answers ({answeredSet.size}/{flat.length} answered)
            </button>
            {data.config.timerMode === "SECTION" && sectionLeft !== null ? (
              <span
                className={`text-xs font-mono font-bold ${
                  sectionLeft < 60 ? "text-rose-600" : "text-slate-600"
                }`}
              >
                Section time: {fmt(sectionLeft)}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* body */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6">
        {currentSection ? (
          <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
              Section {currentSection.code} &middot; {currentSection.name}
            </p>
            {currentSection.description ? (
              <p className="text-sm text-slate-600 mt-0.5">{currentSection.description}</p>
            ) : null}
          </div>
        ) : null}

        <div className="card p-5 sm:p-7">
          <h2 className="text-lg sm:text-xl font-semibold leading-snug whitespace-pre-wrap">
            {current.prompt}
          </h2>
          <div className="mt-5">
            <QuestionRenderer
              question={current}
              value={answers[current.id] ?? emptyAnswer}
              onChange={(v) => {
                setAnswers((prev) => ({ ...prev, [current.id]: v }));
                scheduleSave(index);
              }}
            />
          </div>
        </div>

        {submitError ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        ) : null}
      </main>

      {/* footer nav */}
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white no-print">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!prevAllowed}
            onClick={() => goTo(index - 1)}
          >
            &larr; Previous
          </button>

          <span className="text-xs text-slate-500 hidden sm:block">
            {isFirstInSection && !data.config.allowBack
              ? "Answers are final once you move on"
              : "Your answer saves automatically"}
          </span>

          {isLast ? (
            <button type="button" className="btn btn-primary" onClick={() => setReview(true)}>
              Review &amp; submit
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => goTo(index + 1)}>
              Next &rarr;
            </button>
          )}
        </div>
      </footer>

      {/* section expired overlay */}
      {sectionExpired && !review ? (
        <div className="fixed inset-0 z-30 bg-slate-900/60 flex items-center justify-center px-4">
          <div className="card max-w-md p-6 text-center">
            <h2 className="font-bold text-lg">Section time is up</h2>
            <p className="mt-2 text-sm text-slate-600">
              Your saved answers are safe. Continue to the next section.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {nextSectionIndex >= 0 ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => goTo(nextSectionIndex)}
                >
                  Continue to next section
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void submit(true)}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit assessment"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* review overlay */}
      {review ? (
        <div className="fixed inset-0 z-30 bg-slate-900/60 overflow-y-auto px-4 py-8">
          <div className="mx-auto max-w-2xl card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-xl">Review your answers</h2>
                <p className="text-sm text-slate-600 mt-1">
                  {answeredSet.size} of {flat.length} answered &middot;{" "}
                  <strong className="text-amber-600">{unanswered.length} unanswered</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReview(false)}
              >
                Close
              </button>
            </div>

            {unanswered.length > 0 ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {unanswered.length} question{unanswered.length > 1 ? "s are" : " is"} still
                unanswered:{" "}
                {unanswered
                  .map((q) => flat.findIndex((x) => x.id === q.id) + 1)
                  .slice(0, 20)
                  .join(", ")}
                {unanswered.length > 20 ? "..." : ""}. Unanswered questions score zero.
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Every question has an answer. You are ready to submit.
              </div>
            )}

            <div className="mt-5 grid grid-cols-6 sm:grid-cols-10 gap-2">
              {flat.map((q, i) => {
                const done = answeredSet.has(q.id);
                const jumpable = data.config.allowBack || i >= index;
                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={!jumpable}
                    onClick={() => {
                      setReview(false);
                      goTo(i);
                    }}
                    className={`h-10 rounded-md text-xs font-bold border ${
                      done
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-amber-50 border-amber-300 text-amber-700"
                    } ${jumpable ? "" : "opacity-40 cursor-not-allowed"}`}
                    aria-label={`Question ${i + 1}, ${done ? "answered" : "unanswered"}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
              Once you submit, your answers are final and your technology profile is generated.
              You cannot change answers afterwards.
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setReview(false)}>
                Back to questions
              </button>
              <button
                type="button"
                className="btn btn-primary px-6"
                disabled={submitting}
                onClick={() => void submit(false)}
              >
                {submitting
                  ? "Scoring your assessment..."
                  : unanswered.length > 0
                    ? `Submit anyway (${unanswered.length} unanswered)`
                    : "Submit assessment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* submitting veil */}
      {submitting ? (
        <div className="fixed inset-0 z-40 bg-white/90 flex flex-col items-center justify-center px-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 font-semibold">Building your technology profile...</p>
          <p className="mt-1 text-sm text-slate-500">
            Scoring usually takes a few seconds. Please keep this page open.
          </p>
        </div>
      ) : null}
    </div>
  );
}
