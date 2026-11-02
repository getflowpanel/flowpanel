import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkUpgradeGuide } from "../docs/check-upgrade";

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function repo(changeset: string, rows: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "fp-upgrade-"));
  roots.push(root);
  mkdirSync(join(root, ".changeset"));
  mkdirSync(join(root, "apps/site/content/docs/guides"), { recursive: true });
  writeFileSync(join(root, ".changeset/kit-0-4-0.md"), changeset);
  writeFileSync(
    join(root, "apps/site/content/docs/guides/upgrade.mdx"),
    ["| 0.3 | 0.4 |", "| --- | --- |", ...rows].join("\n"),
  );
  return root;
}

describe("upgrade guide rows", () => {
  it("passes when every Breaking: bullet's first code span has a row", () => {
    const root = repo("---\n---\n\n- Breaking: `basePath` is gone.\n- Added `x`.\n", [
      '| `basePath: "/ops"` | `paths: { admin: "/ops" }` |',
    ]);
    expect(checkUpgradeGuide(root)).toEqual([]);
  });

  it("names the bullet whose change has no row, and one that names nothing", () => {
    const root = repo(
      "---\n---\n\n- Breaking: `perPage` is now `pageSize`.\n- Breaking: things changed.\n",
      ["| `basePath` | `paths` |"],
    );
    expect(checkUpgradeGuide(root)).toEqual([
      expect.objectContaining({ code: "upgrade-breaking-row", line: 4 }),
      expect.objectContaining({ code: "upgrade-breaking-subject", line: 5 }),
    ]);
  });
});
