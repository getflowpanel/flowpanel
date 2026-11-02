/** Characters of one long value an audit preview keeps. */
export const AUDIT_VALUE_PREVIEW = 400;

/** Characters of values one event's stored preview keeps in total. */
export const AUDIT_STORED_PREVIEW = 4000;

/** The key a stored preview hides a long value behind; a value stored whole under it would read as a preview. */
export const AUDIT_PREVIEW_KEY = "__flowpanelPreview";

/** What `diff_preview` holds for an event from before 0.4 whose diff was too large to copy: its field names per side. */
export const AUDIT_TOO_LARGE_KEY = "__flowpanelTooLarge";

/** The start of one long value and its full length, as `diff_preview` stores it. */
export interface StoredAuditPreview {
  text: string;
  length: number;
}

const bigints = (_key: string, inner: unknown): unknown =>
  typeof inner === "bigint" ? inner.toString() : inner;

/** A stored value as text: a string as is, an object as indented JSON. */
export function auditValueText(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(value, bigints, 2) ?? String(value));
}

/** A string or an object too long to print whole. */
export function isLongAuditValue(value: unknown): boolean {
  if (typeof value === "string") return value.length > AUDIT_VALUE_PREVIEW;
  if (typeof value !== "object" || value === null) return false;
  return (JSON.stringify(value, bigints)?.length ?? 0) > AUDIT_VALUE_PREVIEW;
}

/** `text` cut to at most `max` characters, never inside a surrogate pair or a `\r\n`. */
export function cutAuditText(text: string, max: number): string {
  let end = Math.min(text.length, Math.max(0, max));
  if (end === text.length) return text;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  else if (text[end - 1] === "\r" && text[end] === "\n") end -= 1;
  return text.slice(0, end);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The preview a stored value hides behind, or `null` for a value stored whole. */
export function storedAuditPreview(value: unknown): StoredAuditPreview | null {
  if (!isRecord(value) || !Object.hasOwn(value, AUDIT_PREVIEW_KEY)) return null;
  const inner = value[AUDIT_PREVIEW_KEY];
  if (!isRecord(inner) || typeof inner.text !== "string" || typeof inner.length !== "number") {
    return null;
  }
  return { text: inner.text, length: inner.length };
}

class StoredBudget {
  #left = AUDIT_STORED_PREVIEW;

  keep(value: unknown): unknown {
    if (typeof value !== "string" && (typeof value !== "object" || value === null)) return value;
    const full = auditValueText(value);
    if (!isLongAuditValue(value) && full.length <= this.#left) {
      this.#left -= full.length;
      return value;
    }
    const text = cutAuditText(full, Math.min(AUDIT_VALUE_PREVIEW, this.#left));
    this.#left -= text.length;
    return { [AUDIT_PREVIEW_KEY]: { text, length: full.length } };
  }
}

function previewSide(side: unknown, budget: StoredBudget): unknown {
  if (!isRecord(side)) return budget.keep(side);
  return Object.fromEntries(
    Object.entries(side).map(([field, value]) => [field, budget.keep(value)]),
  );
}

/** The diff with each long value cut to its start, within one budget per event: what History and the Audit log read. */
export function auditDiffPreview(
  diff: { before: unknown; after: unknown } | undefined,
): { before: unknown; after: unknown } | undefined {
  if (!diff) return diff;
  const budget = new StoredBudget();
  return { before: previewSide(diff.before, budget), after: previewSide(diff.after, budget) };
}
