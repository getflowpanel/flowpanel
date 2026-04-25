/**
 * "Did you mean?" — given a typo and a list of valid candidates, pick the
 * closest ones by Levenshtein distance. Used for config key suggestions.
 *
 * We cap candidates at 3 and require a max distance proportional to input
 * length so unrelated strings don't surface.
 */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Returns up to 3 candidates whose distance from `input` is within a
 * reasonable threshold (~30% of input length, minimum 2).
 */
export function didYouMean(input: string, candidates: readonly string[]): string[] {
  if (!input || candidates.length === 0) return [];
  const threshold = Math.max(2, Math.floor(input.length * 0.4));
  const scored = candidates
    .map((c) => [c, levenshtein(input.toLowerCase(), c.toLowerCase())] as const)
    .filter(([, d]) => d > 0 && d <= threshold)
    .sort((a, b) => a[1] - b[1]);
  return scored.slice(0, 3).map(([c]) => c);
}
