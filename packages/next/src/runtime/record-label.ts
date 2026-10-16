type Row = Record<string, unknown>;

const LABEL_KEYS = ["name", "title", "email"];

/** The row's name, title or email, the first that holds text. */
export function labelValue(row: Row): string | undefined {
  for (const key of LABEL_KEYS) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}
