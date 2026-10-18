export interface ColumnPrefs {
  widths: Record<string, number>;
  visibility: Record<string, boolean>;
}

export const NO_COLUMN_PREFS: ColumnPrefs = { widths: {}, visibility: {} };
const YEAR_S = 60 * 60 * 24 * 365;
const MAX_VALUE = 3500;

function entries<Value>(
  raw: unknown,
  keep: (value: unknown) => value is Value,
): Record<string, Value> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, Value] => keep(entry[1])),
  );
}

const isWidth = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 40 && value <= 4000;
const isFlag = (value: unknown): value is boolean => typeof value === "boolean";

export const columnPrefsCookieName = (resource: string) =>
  `fp-columns-${resource.replace(/[^A-Za-z0-9_-]/g, "_")}`;

/** The prefs a list's cookie holds, dropping anything malformed. */
export function readColumnPrefs(cookieHeader: string | null, resource: string): ColumnPrefs {
  const name = `${columnPrefsCookieName(resource)}=`;
  const pair = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name));
  if (!pair) return NO_COLUMN_PREFS;
  try {
    const raw: unknown = JSON.parse(decodeURIComponent(pair.slice(name.length)));
    if (typeof raw !== "object" || raw === null) return NO_COLUMN_PREFS;
    return {
      widths: entries("widths" in raw ? raw.widths : undefined, isWidth),
      visibility: entries("visibility" in raw ? raw.visibility : undefined, isFlag),
    };
  } catch {
    return NO_COLUMN_PREFS;
  }
}

/** Keeps prefs for the list's current columns only, and never hides them all: the first stays shown. */
export function fitColumnPrefs(
  prefs: ColumnPrefs,
  columns: ReadonlyArray<{ field: string; hidden?: boolean }>,
): ColumnPrefs {
  const fields = new Set(columns.map((c) => c.field));
  const shown = columns.filter((c) => !c.hidden).map((c) => c.field);
  const widths = Object.fromEntries(Object.entries(prefs.widths).filter(([f]) => fields.has(f)));
  const visibility = Object.fromEntries(
    Object.entries(prefs.visibility).filter(([f]) => shown.includes(f)),
  );
  const first = shown[0];
  if (first !== undefined && shown.every((f) => visibility[f] === false)) delete visibility[first];
  return { widths, visibility };
}

const encode = (prefs: ColumnPrefs) => encodeURIComponent(JSON.stringify(prefs));

/** The `document.cookie` assignment that remembers the prefs under `path`, or forgets them once they are all default. */
export function columnPrefsCookie(resource: string, prefs: ColumnPrefs, path: string): string {
  const hidden = Object.fromEntries(Object.entries(prefs.visibility).filter(([, on]) => !on));
  let value = encode({ widths: prefs.widths, visibility: hidden });
  if (value.length > MAX_VALUE) value = encode({ widths: {}, visibility: hidden });
  if (value.length > MAX_VALUE) value = "";
  const unchanged = Object.keys(prefs.widths).length === 0 && Object.keys(hidden).length === 0;
  const keep = !unchanged && value !== "";
  return `${columnPrefsCookieName(resource)}=${keep ? value : ""}; path=${path}; max-age=${keep ? YEAR_S : 0}; samesite=lax`;
}
