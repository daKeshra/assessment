import { NextRequest, NextResponse } from "next/server";
import { parseJson, withApi } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";

export const GET = withApi(async () => {
  await requireSession();
  const settings = await db.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
  return NextResponse.json({ settings });
});

/**
 * Update settings (thresholds, component weights, timer, anti-cheat).
 * Values are validated against each setting's declared type (PRD §43).
 */
export const PATCH = withApi(async (req: NextRequest) => {
  const session = await requireSession([ROLES.ADMIN]);
  const body = (await parseJson(req)) as Record<string, unknown>;
  const rows = await db.setting.findMany();
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

  const applied: Record<string, string> = {};
  for (const [key, raw] of Object.entries(body)) {
    const row = byKey[key];
    if (!row) continue;

    let value: string;
    if (row.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      if (key.startsWith("w_") && (n < 0 || n > 100)) continue;
      if (key === "duration_minutes" && (n < 1 || n > 600)) continue;
      value = String(n);
    } else if (row.type === "boolean") {
      value = raw === true || raw === "true" ? "true" : "false";
    } else if (row.type === "select") {
      const allowed = (row.options ?? "").split(",").map((s) => s.trim());
      const v = String(raw);
      if (!allowed.includes(v)) continue;
      value = v;
    } else {
      value = String(raw).slice(0, 300);
    }

    await db.setting.update({ where: { key }, data: { value } });
    applied[key] = value;
  }

  await logAudit({
    userId: session.id,
    action: "SETTINGS_UPDATED",
    entity: "Setting",
    meta: applied,
    ip: req.headers.get("x-forwarded-for"),
  });

  const settings = await db.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
  return NextResponse.json({ settings, applied });
});
