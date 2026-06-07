function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize an array of row objects to CSV. */
export function toCsv<Row extends Record<string, unknown>>(rows: Row[], fields: string[]): string {
  const header = fields.join(",");
  if (rows.length === 0) return `${header}\n`;
  const body = rows.map((r) => fields.map((f) => escapeCsv(r[f])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

/** Serialize an array of row objects to a JSON string projecting only `fields`. */
export function toJson<Row extends Record<string, unknown>>(rows: Row[], fields: string[]): string {
  return JSON.stringify(
    rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const f of fields) {
        if (f in r) out[f] = r[f];
      }
      return out;
    }),
  );
}
