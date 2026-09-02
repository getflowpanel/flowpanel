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

/** Tokenize CSV text into rows of string cells. */
function parseCsvRows(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input; // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let started = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      started = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      started = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      started = false;
    } else {
      field += ch;
      started = true;
    }
  }
  if (started || field !== "") {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}
