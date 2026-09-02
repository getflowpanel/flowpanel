import { globSync, readFileSync } from "node:fs";

/**
 * Hard cap on production source files under `packages/<pkg>/src`. The
 * threshold forces a `// LOC-OK: <reason>` exemption rather than silently
 * letting walls of code grow — a file over 300 lines is almost always
 * carrying multiple responsibilities that should split.
 *
 * Exempt a file by adding the directive anywhere in it, e.g.:
 *
 *   // LOC-OK: orchestrates the entire table render path — splitting would
 *   // duplicate the column-pin / inline-edit / sort state across files.
 *
 * Re-evaluate exemptions periodically — an old one may no longer apply.
 */
const THRESHOLD = 300;

const offenders: Array<{ file: string; lines: number }> = [];

// `globSync`'s `ignore` is unreliable across Node versions for these
// patterns, so we filter explicitly instead: tests and type-tests never
// count toward the production-source budget.
const isTest = (f: string) => /(?:\/__tests__\/|\.test\.tsx?$|\.test-d\.ts$)/.test(f);

for (const file of globSync("packages/*/src/**/*.{ts,tsx}", { cwd: process.cwd() })) {
  if (isTest(file)) continue;
  const src = readFileSync(file, "utf-8");
  const lines = src.split("\n").length;
  if (lines <= THRESHOLD) continue;
  if (/\/\/ LOC-OK:/.test(src)) continue; // explicit exemption
  offenders.push({ file, lines });
}

if (offenders.length > 0) {
  console.warn(`⚠ ${offenders.length} file(s) over ${THRESHOLD} lines without a LOC-OK directive:`);
  for (const { file, lines } of offenders) console.warn(`  ${file}: ${lines} lines`);
  console.warn(
    `\nFix options:\n` +
      `  1. Split the file into smaller modules.\n` +
      `  2. Add \`// LOC-OK: <one-line reason>\` somewhere in the file if the size is justified.\n`,
  );
  process.exitCode = 1;
} else {
  console.log(`✔ All files at or under ${THRESHOLD} lines (or carrying a LOC-OK directive).`);
}
