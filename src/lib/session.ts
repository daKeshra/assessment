import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/constants";

export const SESSION_COOKIE = "africinnovate_session";
const SESSION_HOURS = 8;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "africinnovate-dev-secret-change-me-in-production-please",
  );
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.id || !payload.role) return null;
    return {
      id: String(payload.id),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
