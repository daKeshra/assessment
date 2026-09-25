import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function AssessmentLinkNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <BrandLogo className="mx-auto h-9 w-auto" priority="lazy" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
          Link unavailable
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          This assessment link is not available
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The link may have been paused or closed by the assessment administrator.
          Please use the latest link you were given or contact admissions for help.
        </p>
        <Link href="/" className="btn btn-primary mt-6">
          Return to Africinnovate
        </Link>
      </div>
    </main>
  );
}
