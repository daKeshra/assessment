"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { ROLES, ROLE_LABELS } from "@/lib/constants";

interface NavItem {
  href: string;
  label: string;
}

const ALL_NAV: (NavItem & { adminOnly?: boolean })[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/candidates", label: "Candidates" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/questions", label: "Questions", adminOnly: true },
  { href: "/admin/versions", label: "Versions & Links", adminOnly: true },
  { href: "/admin/courses", label: "Courses", adminOnly: true },
  { href: "/admin/weights", label: "Weights", adminOnly: true },
  { href: "/admin/competencies", label: "Competencies", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
];

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-xs font-semibold text-slate-500 hover:text-rose-600"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export default function AdminShell({
  name,
  role,
  children,
}: {
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = ALL_NAV.filter((item) => !(item.adminOnly && role !== ROLES.ADMIN));

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="min-h-screen lg:flex">
      {/* sidebar */}
      <aside className="bg-slate-900 text-slate-200 lg:w-60 lg:min-h-screen lg:sticky lg:top-0">
        <div className="px-4 py-4 flex items-center justify-between lg:block">
          <Link href="/admin" className="flex items-center justify-center rounded-lg bg-white p-2">
            <BrandLogo className="h-7 w-auto" priority="lazy" />
          </Link>
          <span className="lg:hidden text-xs text-slate-400">{role}</span>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:px-3 lg:pb-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-brand-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* content */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[role] ?? role}</p>
          </div>
          <LogoutButton />
        </header>
        <main className="px-4 sm:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
