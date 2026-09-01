import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { type PackageManager, pmCommands } from "../../utils/detect";
import { migrateCommand, resolveMigrationExecutor } from "../migrate";

describe("migrate — install hints", () => {
  it("renders the jiti hint in each manager's dialect", () => {
    const hint = (pm: PackageManager): string => pmCommands(pm).addDisplay("jiti", true);
    expect(hint("pnpm")).toBe("pnpm add -D jiti");
    expect(hint("npm")).toBe("npm install --save-dev jiti");
    expect(hint("yarn")).toBe("yarn add -D jiti");
    expect(hint("bun")).toBe("bun add -d jiti");
  });

  it("renders dlx in each manager's dialect", () => {
    expect(pmCommands("pnpm").dlx).toBe("pnpm dlx");
    expect(pmCommands("npm").dlx).toBe("npx");
    expect(pmCommands("yarn").dlx).toBe("yarn dlx");
    expect(pmCommands("bun").dlx).toBe("bunx");
  });
});

describe("migrate --dry-run", () => {
  it("lists on-disk migrations without loading config or reaching the database", async () => {
    const originalCwd = process.cwd();
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "flowpanel-migrate-"));
    const output: string[] = [];
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output.push(String(chunk));
      return true;
    });

    try {
      const migrationsDir = path.join(projectDir, "flowpanel", "migrations");
      await fs.mkdir(migrationsDir, { recursive: true });
      await fs.writeFile(path.join(migrationsDir, "0002_second.sql"), "select 2;");
      await fs.writeFile(path.join(migrationsDir, "0001_first.sql"), "select 1;");
      await fs.writeFile(
        path.join(projectDir, "flowpanel.config.ts"),
        'throw new Error("dry-run must not load config");\n',
      );
      process.chdir(projectDir);

      const cli = new Command();
      migrateCommand(cli);
      await cli.parseAsync(["node", "flowpanel", "migrate", "--dry-run", "--json"]);

      expect(JSON.parse(output.join(""))).toEqual({
        command: "migrate",
        applied: false,
        dryRun: true,
        appliedStateKnown: false,
        pending: ["0001_first", "0002_second"],
      });
    } finally {
      process.chdir(originalCwd);
      stdout.mockRestore();
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });
});

describe("migrate — adapter contract", () => {
  it("uses the adapter's atomic migration operation", async () => {
    const calls: string[] = [];
    const executor = resolveMigrationExecutor({
      applyMigration: async (id, sql) => {
        calls.push(`${id}:${sql}`);
      },
      listAppliedMigrations: async () => new Set(["0001"]),
    });

    expect(executor?.mode).toBe("adapter");
    expect(executor?.warnings).toEqual([]);
    expect(await executor?.listAppliedMigrations()).toEqual(new Set(["0001"]));
    await executor?.applyMigration("0002", "select 1");
    expect(calls).toEqual(["0002:select 1"]);
  });

  it("runs legacy SQL before marking it and exposes the non-atomic warning", async () => {
    const calls: string[] = [];
    const executor = resolveMigrationExecutor({
      runMigrationSql: async (sql) => {
        calls.push(`run:${sql}`);
      },
      markMigrationApplied: async (id) => {
        calls.push(`mark:${id}`);
      },
      listAppliedMigrations: async () => new Set(),
    });

    expect(executor?.mode).toBe("legacy-hooks");
    expect(executor?.warnings).toHaveLength(1);
    expect(executor?.warnings[0]).toContain("legacy non-atomic migration hooks");
    expect(executor?.warnings[0]).toContain("concurrent migrators are not serialized");
    await executor?.applyMigration("0001", "select 1");
    expect(calls).toEqual(["run:select 1", "mark:0001"]);
  });

  it("rejects partial migration contracts", () => {
    expect(
      resolveMigrationExecutor({
        applyMigration: async () => undefined,
      }),
    ).toBeUndefined();
  });
});
