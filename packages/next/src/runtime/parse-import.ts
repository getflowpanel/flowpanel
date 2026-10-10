import { parseCsvRows } from "@flowpanel/core/internal";

/** Parse an uploaded import file into a list of plain row objects. */
export function parseImport(format: "csv" | "json", content: string): Record<string, unknown>[] {
  if (format === "json") {
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      throw new Error("Invalid JSON");
    }
    if (!Array.isArray(data)) throw new Error("JSON import must be an array of objects");
    return data as Record<string, unknown>[];
  }
  return parseCsv(content);
}

function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const header = rows[0] ?? [];
  return rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      if (key) obj[key] = cells[i] ?? "";
    });
    return obj;
  });
}
