import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Command } from "commander";
import { createJiti } from "jiti";
import { describe, expect, it, vi } from "vitest";
import { type PackageManager, pmCommands } from "../../utils/detect";
import { readTsconfigAliases } from "../../utils/tsconfig";
import { migrateCommand, resolveMigrationExecutor } from "../migrate";
import { runCommand } from "./command-harness";

it("loads an alias rooted at inherited baseUrl without appending a literal wildcard", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-migrate-alias-"));
  try {
    await fs.mkdir(path.join(root, "config"));
    await fs.mkdir(path.join(root, "src"));
    await fs.writeFile(
      path.join(root, "config/base.json"),
      JSON.stringify({ compilerOptions: { baseUrl: "../src" } }),
    );
    await fs.writeFile(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        extends: "./config/base.json",
        compilerOptions: { paths: { "@/*": ["*"] } },
      }),
    );
    await fs.writeFile(path.join(root, "src/db.ts"), 'export const db = "local-fixture";');
    await fs.writeFile(path.join(root, "flowpanel.config.ts"), 'export { db } from "@/db";');
    const jiti = createJiti(root, { alias: await readTsconfigAliases(root) });
    const loaded = await jiti.import<{ db: string }>(path.join(root, "flowpanel.config.ts"));
    expect(loaded.db).toBe("local-fixture");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

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
      await fs.writeFile(
        path.join(projectDir, "package.json"),
        JSON.stringify({ dependencies: { next: "16.3.4" } }),
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

describe("migrate — a 0.3 audit table", () => {
  it("lists the 0002 it would write beside a 0.3 0001 on a dry run", async () => {
    const run = await runCommand(migrateCommand, ["migrate", "--dry-run", "--json"], {
      "package.json": JSON.stringify({ dependencies: { next: "16.3.4" } }),
      "flowpanel.config.ts": "export default {};\n",
      "flowpanel/migrations/0001_init.sql":
        "CREATE TABLE IF NOT EXISTS flowpanel_audit_log (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid()\n);\n",
    });
    expect(run.exit).toBeNull();
    expect(JSON.parse(run.stdout)).toMatchObject({
      dryRun: true,
      pending: ["0001_init", "0002_audit_log_0_4"],
    });
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

    expect(await executor?.listAppliedMigrations()).toEqual(new Set(["0001"]));
    await executor?.applyMigration("0002", "select 1");
    expect(calls).toEqual(["0002:select 1"]);
  });

  it("rejects partial migration contracts", () => {
    expect(
      resolveMigrationExecutor({
        applyMigration: async () => undefined,
      }),
    ).toBeUndefined();
  });
});

describe("migrate — where it runs", () => {
  const NEXT = JSON.stringify({
    dependencies: { next: "16.3.4" },
    packageManager: "npm@10.9.0",
  });

  async function runIn(files: Record<string, string>, args: string[] = []) {
    const run = await runCommand(migrateCommand, ["migrate", ...args], files);
    return {
      exit: run.exit,
      stdout: run.stdout.replaceAll(run.dir, "<cwd>"),
      stderr: run.stderr.replaceAll(run.dir, "<cwd>"),
    };
  }

  it("exits 1 and says to run init when there is no config, even with migrations on disk", async () => {
    const result = await runIn({
      "package.json": NEXT,
      "flowpanel/migrations/0001_init.sql": "select 1;",
    });
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain("[flowpanel] flowpanel.config.ts: not found in ");
    expect(result.stderr).toContain("Run `npx @flowpanel/cli init` first.");
  });

  it("exits 1 for a project with no config and no migrations, as new does", async () => {
    const result = await runIn({ "package.json": NEXT });
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain("[flowpanel] flowpanel.config.ts: not found in ");
    expect(result.stderr).toContain("Run `npx @flowpanel/cli init` first.");
  });

  it("puts the same message in the JSON document", async () => {
    const result = await runIn({ "package.json": NEXT }, ["--json"]);
    expect(result.exit).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      command: "migrate",
      applied: false,
      error: expect.stringMatching(
        /^\[flowpanel\] flowpanel\.config\.ts: not found in .+\. Run `npx @flowpanel\/cli init` first\.$/,
      ),
    });
  });

  it("refuses an empty DATABASE_URL instead of letting the driver fall back to localhost", async () => {
    const saved = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "";
    try {
      const result = await runIn({
        "package.json": NEXT,
        "flowpanel.config.ts": 'import { db } from "./db";\nexport default { adapter: db };\n',
        "db.ts": "export const db = { url: process.env.DATABASE_URL };\n",
        "flowpanel/migrations/0001_init.sql": "select 1;",
      });
      expect(result.exit).toBe(1);
      expect(result.stderr).toContain(
        "DATABASE_URL is empty, so the database client would connect",
      );
      expect(result.stderr).toContain("DATABASE_URL=… npx flowpanel migrate");
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
    }
  });

  async function withUnset<T>(names: string[], run: () => Promise<T>): Promise<T> {
    const saved = names.map((name) => [name, process.env[name]] as const);
    for (const name of names) delete process.env[name];
    try {
      return await run();
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }

  it("refuses an unset DATABASE_URL that the db module reads with no fallback", async () => {
    const result = await withUnset(["DATABASE_URL"], () =>
      runIn({
        "package.json": NEXT,
        "flowpanel.config.ts": 'import { db } from "./db";\nexport default { adapter: db };\n',
        "db.ts": "export const db = { url: process.env.DATABASE_URL! };\n",
        "flowpanel/migrations/0001_init.sql": "select 1;",
      }),
    );
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL is not set, so the database client");
  });

  it("does not ask for REDIS_URL or a URL the db module falls back from", async () => {
    const result = await withUnset(["DATABASE_URL", "REDIS_URL", "NEXT_PUBLIC_APP_URL"], () =>
      runIn({
        "package.json": NEXT,
        "flowpanel.config.ts": [
          'import { db } from "./db";',
          'import site from "./site";',
          "const redis = process.env.REDIS_URL;",
          "export default { adapter: db, redis, site };",
        ].join("\n"),
        "site.ts": "export default process.env.NEXT_PUBLIC_APP_URL;\n",
        "db.ts": 'export const db = { url: process.env.DATABASE_URL ?? "file:local.db" };\n',
        "flowpanel/migrations/0001_init.sql": "select 1;",
      }),
    );
    expect(result.exit).toBe(1);
    expect(result.stderr).not.toContain("is not set");
    expect(result.stderr).toContain("The config's adapter cannot run migrations.");
  });

  it("prints JSON when the database cannot be reached", async () => {
    const saved = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://u:p@localhost:59999/app";
    try {
      const result = await runIn(
        {
          "package.json": NEXT,
          "flowpanel.config.ts": [
            "const refused = Object.assign(new Error('connect ECONNREFUSED ::1:59999'), {",
            "  code: 'ECONNREFUSED', address: '::1', port: 59999,",
            "});",
            "export default { adapter: {",
            "  listAppliedMigrations: async () => { throw refused; },",
            "  applyMigration: async () => {},",
            "} };",
            "",
          ].join("\n"),
          "flowpanel/migrations/0001_init.sql": "select 1;",
        },
        ["--json"],
      );
      expect(result.exit).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual({
        command: "migrate",
        applied: false,
        migrations: [],
        error: "Cannot reach the database at localhost:59999 (ECONNREFUSED). Check DATABASE_URL.",
      });
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
    }
  });

  it("names the directory when it is not a Next.js project", async () => {
    const result = await runIn({});
    expect(result.exit).toBe(1);
    expect(result.stderr).toContain(
      "No Next.js project found in <cwd>. Run this from your project root.",
    );
  });

  it("still exits 0 when the config exists and there is nothing to apply", async () => {
    const result = await runIn({
      "package.json": NEXT,
      "flowpanel.config.ts": "export default {};\n",
    });
    expect(result.exit).toBeNull();
    expect(result.stdout).toContain("No migrations found in flowpanel/migrations");
  });
});
