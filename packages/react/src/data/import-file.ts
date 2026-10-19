import { csvLine, csvRecords } from "@flowpanel/core/internal";

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
  const { header, records } = csvRecords(content);
  return { name, format, content, rowCount: records.length, header, records };
}

/** The file's columns the import does not read, in file order; `accepted` is lower-cased. */
export function skippedColumns(header: readonly string[], accepted: readonly string[]): string[] {
  const reads = new Set(accepted);
  return header.filter((column) => column.trim() !== "" && !reads.has(column.trim().toLowerCase()));
}

/** The refused rows as CSV, each with the server's reason in a last `error` column. */
export function failedRowsCsv(
  file: ImportFile,
  failed: FailedImportRow[],
  errorColumn: string,
): string {
  const lines = failed.map(({ row, error }) => {
    const record = file.records[row - 1] ?? {};
    return csvLine([...file.header.map((key) => record[key]), error]);
  });
  return [csvLine([...file.header, errorColumn]), ...lines].join("\r\n");
}
