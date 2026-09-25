import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isLogin = req.nextUrl.pathname === "/admin/login";

  const adminOnlyPage =
    /^\/admin\/(questions|versions|courses|weights|competencies|settings)(?:\/|$)/.test(
      req.nextUrl.pathname,
    );
  if (session && adminOnlyPage && session.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  if (!session && !isLogin) {
    if (req.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
