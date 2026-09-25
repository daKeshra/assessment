import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { HttpError, jsonError, parseJson, withApi } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export const POST = withApi(async (req: NextRequest) => {
  const ip = clientIp(req);
  const limit = rateLimit(`login:${ip}`, { limit: 10, windowMs: 5 * 60_000 });
  if (!limit.ok) throw new HttpError(429, "Too many login attempts. Try again shortly.");

  const body = loginSchema.parse(await parseJson(req));

  const user = await db.user.findUnique({ where: { email: body.email } });
  const valid = user ? await bcrypt.compare(body.password, user.passwordHash) : false;
  if (!user || !valid) {
    await logAudit({ action: "LOGIN_FAILED", entity: "User", entityId: body.email, ip });
    throw new HttpError(401, "Invalid email or password");
  }
  if (!user.active) throw new HttpError(403, "This account has been deactivated");

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as never,
  });

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  // Secure only when the request actually arrived over HTTPS (directly or via
  // a TLS-terminating proxy). Plain-HTTP localhost keeps working.
  const proto = (req.headers.get("x-forwarded-proto") ?? "").toLowerCase();
  const isHttps = req.nextUrl.protocol === "https:" || proto.startsWith("https");
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  await logAudit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ip });
  return res;
});
