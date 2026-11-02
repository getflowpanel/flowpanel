/** Edit distance counting a swap of two neighbours as one edit, abandoned once it passes `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const substitute = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      let step = Math.min(substitute, (previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        step = Math.min(step, (before[j - 2] ?? 0) + 1);
      }
      row.push(step);
      if (step < best) best = step;
    }
    if (best > max) return max + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length] ?? max + 1;
}

const squash = (value: string): string => value.toLowerCase().replace(/[_-]/g, "");

/** The known name a typo most likely meant, ignoring case and separators, within an edit distance of two. */
export function near(target: string, known: readonly string[]): string | null {
  const squashed = squash(target);
  const same = known.find((candidate) => squash(candidate) === squashed);
  if (same !== undefined) return same;

  const max = target.length <= 2 ? 0 : target.length <= 4 ? 1 : 2;
  let best: string | null = null;
  let bestDistance = max + 1;
  for (const candidate of known) {
    const d = distance(target, candidate, max);
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
