import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type PackageManager, pmCommands } from "../../utils/detect.js";

const MIGRATE_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrate.ts");

describe("migrate — install hints", () => {
  it("renders the jiti hint in each manager's dialect", () => {
    const hint = (pm: PackageManager): string => pmCommands(pm).addDisplay("jiti", true);
    expect(hint("pnpm")).toBe("pnpm add -D jiti");
    expect(hint("npm")).toBe("npm install --save-dev jiti");
    expect(hint("yarn")).toBe("yarn add -D jiti");
    expect(hint("bun")).toBe("bun add -d jiti");
  });

  it("hardcodes no package-manager install command", async () => {
    const src = await fs.readFile(MIGRATE_SRC, "utf8");
    expect(src).not.toMatch(/(pnpm|npm|yarn|bun) (add|install) /);
    expect(src).toContain('addDisplay("jiti", true)');
  });

  it("points a config-less project at the package that exists on npm", async () => {
    const src = await fs.readFile(MIGRATE_SRC, "utf8");
    expect(src).toContain("pnpm dlx @flowpanel/cli init");
    expect(src).not.toMatch(/dlx flowpanel init/);
  });
});
