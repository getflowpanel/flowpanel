import { csvField, parseCsvRows } from "@flowpanel/core/internal";

export type ImportFormat = "csv" | "json";

export interface ImportFile {
  name: string;
  format: ImportFormat;
  content: string;
  /** Data rows, the header excluded. */
  rowCount: number;
  /** The file's columns and rows, to write back the rows the server refused. */
  header: string[];
  records: Record<string, unknown>[];
}

export interface FailedImportRow {
  /** The data row's number, counting from 1 after the header. */
  row: number;
  error: string;
}

/** The file read as the server will read it, or `null` when it is not valid CSV or JSON. */
export function readImportFile(
  name: string,
  format: ImportFormat,
  content: string,
): ImportFile | null {
  if (format === "json") {
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      return null;
    }
    if (!Array.isArray(data)) return null;
    const records = data.map(
      (item): Record<string, unknown> =>
        item !== null && typeof item === "object" && !Array.isArray(item) ? { ...item } : {},
    );
    const header = [...new Set(records.flatMap((record) => Object.keys(record)))];
    return { name, format, content, rowCount: records.length, header, records };
  }
  const [header = [], ...rows] = parseCsvRows(content);
  const records = rows.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""])),
  );
  return { name, format, content, rowCount: records.length, header, records };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** The refused rows as CSV, each with the server's reason in a last `error` column. */
export function failedRowsCsv(
  file: ImportFile,
  failed: FailedImportRow[],
  errorColumn: string,
): string {
  const header = [...file.header, errorColumn];
  const lines = failed.map(({ row, error }) => {
    const record = file.records[row - 1] ?? {};
    return [...file.header.map((key) => cellText(record[key])), error].map(csvField).join(",");
  });
  return [header.map(csvField).join(","), ...lines].join("\r\n");
}
