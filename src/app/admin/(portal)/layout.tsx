import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Session guard + app shell for the staff portal. Lives in a route group so
 * /admin/login renders standalone (a redirect to itself here would loop).
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell name={session.name} role={session.role}>
      {children}
    </AdminShell>
  );
}
