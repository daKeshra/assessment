/** Minimal CSV writer with RFC-4180 escaping. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const body = rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell == null) return "";
          const s = String(cell);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
  // BOM so Excel opens UTF-8 (₦ etc.) correctly.
  return "\uFEFF" + body;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
