/** CSV text as rows of cells: quoted fields, doubled quotes, CRLF and a leading BOM; blank lines dropped. */
export function parseCsvRows(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let started = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
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
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

/** CSV text as its header and one record per data row; a column with an empty header is dropped. */
export function csvRecords(input: string): {
  header: string[];
  records: Record<string, string>[];
} {
  const [first = [], ...rows] = parseCsvRows(input);
  const header = first.filter((key) => key !== "");
  const records = rows.map((cells) => {
    const record: Record<string, string> = {};
    first.forEach((key, index) => {
      if (key) record[key] = cells[index] ?? "";
    });
    return record;
  });
  return { header, records };
}
