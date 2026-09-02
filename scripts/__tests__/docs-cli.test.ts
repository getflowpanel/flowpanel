import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkCli } from "../docs/check-cli";

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("CLI documentation checks", () => {
  it("rejects unknown generated command references", () => {
    const root = mkdtempSync(join(tmpdir(), "flowpanel-docs-cli-"));
    fixtures.push(root);
    const reference = join(root, "apps/site/content/docs/reference");
    mkdirSync(reference, { recursive: true });
    writeFileSync(
      join(reference, "cli.mdx"),
      '<CliReference />\n<CliReference command="missing" />\n',
    );

    expect(checkCli(root)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "cli-command-unknown" })]),
    );
  });
});
