import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/session";

export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

type ApiHandler<T> = (
  req: NextRequest,
  ctx: { params: Promise<T> },
) => Promise<Response> | Response;

/** Uniform error mapping for every API route. */
export function withApi<T = Record<string, string>>(handler: ApiHandler<T>) {
  return async (req: NextRequest, ctx: { params: Promise<T> }): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return jsonError(e.status, e.message, e.extra);
      if (e instanceof AuthError) return jsonError(e.status, e.message);
      if (e instanceof ZodError) {
        return jsonError(400, "Validation failed", {
          issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      console.error("[api] unhandled error", e);
      return jsonError(500, "Internal server error");
    }
  };
}

export function parseJson(req: NextRequest): Promise<unknown> {
  return req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body");
  });
}
