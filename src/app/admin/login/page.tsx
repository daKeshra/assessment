"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setBusy(false);
        return;
      }
      const next = search.get("next");
      router.replace(next && next.startsWith("/") ? next : "/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <BrandLogo className="mx-auto h-10 w-auto" />
          <h1 className="mt-3 text-xl font-bold">Africinnovate Staff Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Technology Career Aptitude Assessment
          </p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Access is restricted to authorised Africinnovate staff. All activity is logged.
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
