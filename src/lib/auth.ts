import { cookies } from "next/headers";
import { ROLES, type Role } from "@/lib/constants";
import {
  AuthError,
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  type SessionUser,
} from "@/lib/session";

export { AuthError, SESSION_COOKIE, createSessionToken, verifySessionToken };
export type { SessionUser };

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const canViewCandidates = (role: Role) =>
  role === ROLES.ADMIN || role === ROLES.ADMISSIONS || role === ROLES.INSTRUCTOR;

export const canConfigure = (role: Role) => role === ROLES.ADMIN;

export const canExport = (role: Role) => role === ROLES.ADMIN || role === ROLES.ADMISSIONS;

export const canScoreResponses = (role: Role) => role === ROLES.ADMIN || role === ROLES.INSTRUCTOR;

/** Throws AuthError when unauthenticated/unauthorized. Used inside API handlers. */
export async function requireSession(roles?: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Authentication required");
  if (roles && !roles.includes(session.role)) throw new AuthError(403, "Insufficient permissions");
  return session;
}

/** For server components: returns session or null. */
export async function requirePageSession(roles?: Role[]): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  if (roles && !roles.includes(session.role)) return null;
  return session;
}
