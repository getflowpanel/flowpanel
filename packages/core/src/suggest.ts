/** Edit distance, abandoned as soon as it passes `max` — a far name is not a suggestion. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const substitute = (previous[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const step = Math.min(substitute, (previous[j] as number) + 1, (row[j - 1] as number) + 1);
      row.push(step);
      if (step < best) best = step;
    }
    if (best > max) return max + 1;
    previous = row;
  }
  return previous[b.length] as number;
}

const squash = (value: string): string => value.toLowerCase().replace(/[_-]/g, "");

/**
 * The known name a typo most likely meant: an exact match once casing and word
 * separators are ignored, else the closest within an edit distance of two.
 */
export function near(target: string, known: readonly string[]): string | null {
  const squashed = squash(target);
  const same = known.find((candidate) => squash(candidate) === squashed);
  if (same !== undefined) return same;

  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of known) {
    const d = distance(target, candidate, 2);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

/** The suggestion clause appended to a config error, or nothing when no name is close. */
export function didYouMean(target: string, known: readonly string[]): string {
  const match = near(target, known);
  return match === null ? "" : ` Did you mean "${match}"?`;
}
