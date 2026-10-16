/** Exact words first, then words that start with the query, then any that hold it; no fuzzy matches, so Enter opens what was typed. */
export function paletteScore(value: string, search: string, keywords: string[] = []): number {
  const query = search.trim().toLowerCase();
  if (query === "") return 1;
  const words = [value, ...keywords].map((word) => word.toLowerCase());
  if (words.includes(query)) return 1;
  if (words.some((word) => word.startsWith(query))) return 0.8;
  if (words.some((word) => word.split(/[\s/._-]+/).some((part) => part.startsWith(query)))) {
    return 0.6;
  }
  return words.some((word) => word.includes(query)) ? 0.4 : 0;
}
