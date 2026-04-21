import { readFileSync, globSync } from "node:fs";

const THRESHOLD = 250;
const warnings: Array<{ file: string; lines: number }> = [];

for (const file of globSync("packages/*/src/**/*.{ts,tsx}", {
  ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "**/*.test-d.ts"],
  cwd: process.cwd(),
})) {
  const lines = readFileSync(file, "utf-8").split("\n").length;
  if (lines > THRESHOLD) warnings.push({ file, lines });
}

if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} files over ${THRESHOLD} lines:`);
  for (const { file, lines } of warnings) console.warn(`  ${file}: ${lines} lines`);
  // Non-fatal warning
} else {
  console.log(`✔ All files under ${THRESHOLD} lines.`);
}
