import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { getSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  if (session) await logAudit({ userId: session.id, action: "LOGOUT", entity: "User", entityId: session.id });
  return res;
}
