import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DocsProblem } from "./types";

const GUIDE = "apps/site/content/docs/guides/upgrade.mdx";

/** The rows of the upgrade guide's tables, as written. */
function upgradeRows(guide: string): string[] {
  return guide.split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| ---"));
}

/** Every changeset bullet that starts with "Breaking:", with its file and line. */
export function breakingBullets(root: string): Array<{ file: string; line: number; text: string }> {
  const dir = join(root, ".changeset");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .flatMap((name) =>
      readFileSync(join(dir, name), "utf8")
        .split("\n")
        .flatMap((text, index) =>
          text.startsWith("- Breaking:")
            ? [{ file: `.changeset/${name}`, line: index + 1, text }]
            : [],
        ),
    );
}

/**
 * Each "Breaking:" bullet names what broke in its first code span; a code span in some row of the
 * upgrade guide must contain that name, so no breaking change ships without its replacement.
 */
export function checkUpgradeGuide(root: string): DocsProblem[] {
  const path = join(root, GUIDE);
  if (!existsSync(path)) return [];
  const rows = upgradeRows(readFileSync(path, "utf8"));
  return breakingBullets(root).flatMap(({ file, line, text }) => {
    const subject = /`[^`]+`/.exec(text)?.[0];
    if (!subject) {
      return [
        {
          code: "upgrade-breaking-subject",
          file,
          line,
          message: "A Breaking: bullet must name what broke in a code span.",
          suggestion: "Put the removed or changed name in backticks first.",
        },
      ];
    }
    const name = subject.slice(1, -1);
    const named = rows.some((row) =>
      (row.match(/`[^`]+`/g) ?? []).some((span) => span.includes(name)),
    );
    if (named) return [];
    return [
      {
        code: "upgrade-breaking-row",
        file,
        line,
        message: `${subject} is marked Breaking but no row of the upgrade guide names it.`,
        suggestion: `Add a row with ${subject} and its replacement to ${GUIDE}.`,
      },
    ];
  });
}
