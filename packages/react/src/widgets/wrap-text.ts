export const TWO_LINES = "fp-line-clamp-2 fp-break-words";

/** Spread onto a clamped element so the full text stays reachable on hover. */
export function fullTextTitle(text: unknown): { title?: string } {
  return typeof text === "string" && text !== "" ? { title: text } : {};
}
