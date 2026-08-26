import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type PackageManager, pmCommands } from "../../utils/detect";

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
    expect(src).toMatch(/\$\{pmc\.dlx\} @flowpanel\/cli init/);
    expect(src).not.toMatch(/dlx flowpanel init/);
    expect(src).not.toMatch(/pnpm dlx/);
  });

  it("renders dlx in each manager's dialect", () => {
    expect(pmCommands("pnpm").dlx).toBe("pnpm dlx");
    expect(pmCommands("npm").dlx).toBe("npx");
    expect(pmCommands("yarn").dlx).toBe("yarn dlx");
    expect(pmCommands("bun").dlx).toBe("bunx");
  });
});

describe("migrate --dry-run", () => {
  it("returns before anything that can reach the database", async () => {
    const src = await fs.readFile(MIGRATE_SRC, "utf8");
    const dryRun = src.indexOf("if (opts.dryRun)");
    expect(dryRun).toBeGreaterThan(-1);
    for (const reachesDb of [
      'await import("jiti")',
      "await jiti.import(cfgPath)",
      "await listAppliedMigrations()",
      "await runMigrationSql(",
    ]) {
      expect(src.indexOf(reachesDb)).toBeGreaterThan(dryRun);
    }
  });

  it("says applied state is unknown rather than implying a clean database", async () => {
    const src = await fs.readFile(MIGRATE_SRC, "utf8");
    expect(src).toContain("appliedStateKnown: false");
    expect(src).toContain("Applied state unknown");
  });
});
