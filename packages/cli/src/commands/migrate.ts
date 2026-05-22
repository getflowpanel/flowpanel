import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { fileExists } from "../utils/detect.js";
import { log } from "../utils/log.js";

interface MigrateOptions {
  dryRun?: boolean;
}

interface MigrationAdapter {
  runMigrationSql?: (sql: string) => Promise<void>;
  listAppliedMigrations?: () => Promise<Set<string>>;
  markMigrationApplied?: (id: string) => Promise<void>;
  kind?: string;
}

interface MaybeConfig {
  adapter?: MigrationAdapter;
}

interface JitiOptions {
  interopDefault?: boolean;
  jsx?: boolean;
  alias?: Record<string, string>;
}

interface JitiInstance {
  import: (id: string) => Promise<unknown>;
}

interface JitiModule {
  createJiti: (cwd: string, opts?: JitiOptions) => JitiInstance;
}

// Translate the user's tsconfig `compilerOptions.paths` into a Record jiti
// understands. jiti v2 takes a flat `alias: Record<string, string>` where the
// key may end in `/*` and the value points at an absolute on-disk path. We
// pass through the most common shape — `"@/*": ["./*"]` — and resolve the
// path relative to the project root. Skip silently if tsconfig is absent or
// malformed; users without aliases shouldn't pay a parse-failure tax.
// Strip JSONC comments without mangling string contents (Next.js scaffolds
// emit `"src/**/*"` globs whose `/*` would otherwise be eaten by a naive
// block-comment regex). The scanner tracks string state explicitly.
function stripJsoncComments(src: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < src.length) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

async function readTsconfigAliases(cwd: string): Promise<Record<string, string>> {
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  try {
    const raw = await fs.readFile(tsconfigPath, "utf8");
    const stripped = stripJsoncComments(raw).replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(stripped) as {
      compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string };
    };
    const paths = parsed.compilerOptions?.paths ?? {};
    const baseUrl = parsed.compilerOptions?.baseUrl ?? ".";
    const baseDir = path.resolve(cwd, baseUrl);
    const out: Record<string, string> = {};
    for (const [key, values] of Object.entries(paths)) {
      const target = values?.[0];
      if (!target) continue;
      const cleanKey = key.replace(/\/\*$/, "");
      const cleanTarget = target.replace(/\/\*$/, "");
      out[cleanKey] = path.resolve(baseDir, cleanTarget);
    }
    return out;
  } catch {
    return {};
  }
}

export function migrateCommand(cli: Command): void {
  cli
    .command("migrate")
    .description("Apply SQL migrations from flowpanel/migrations/")
    .option("--dry-run", "Print migrations that would be applied without running them")
    .action(async (opts: MigrateOptions) => {
      p.intro(pc.bgMagenta(pc.black(" FlowPanel migrate ")));

      const cwd = process.cwd();
      const dir = path.join(cwd, "flowpanel", "migrations");

      const files = (await fs.readdir(dir).catch(() => [] as string[]))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      if (files.length === 0) {
        p.outro(pc.yellow(`No migrations found in ${path.relative(cwd, dir)}`));
        return;
      }

      if (opts.dryRun) {
        for (const f of files) log.info(`would apply: ${f}`);
        p.outro(pc.dim(`${files.length} migration${files.length === 1 ? "" : "s"} (dry run)`));
        return;
      }

      const cfgPath = path.join(cwd, "flowpanel.config.ts");
      if (!(await fileExists(cfgPath))) {
        log.err("flowpanel.config.ts not found. Run `pnpm dlx flowpanel init` first.");
        process.exit(1);
      }

      // ── Step 1: bring up jiti. Only the "jiti not installed" case maps to
      // the install hint; anything else (alias resolution failure, syntax
      // error, missing dependency in the config) must surface verbatim.
      let jiti: JitiInstance;
      try {
        const jitiMod = (await import("jiti")) as JitiModule;
        const alias = await readTsconfigAliases(cwd);
        jiti = jitiMod.createJiti(cwd, {
          interopDefault: true,
          jsx: true,
          alias,
        });
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
          log.err("flowpanel migrate needs `jiti` to load your TypeScript config. Install:");
          log.dim("  pnpm add -D jiti");
          process.exit(1);
        }
        throw e;
      }

      // ── Step 2: evaluate the user's flowpanel.config.ts. Errors here are
      // user-actionable (bad alias, missing module, syntax error in the
      // config). Surface the real message — the previous catch-all blamed
      // jiti for every failure mode.
      let config: MaybeConfig;
      try {
        const mod = (await jiti.import(cfgPath)) as { default?: MaybeConfig } | MaybeConfig;
        config = ((mod as { default?: MaybeConfig }).default ?? mod) as MaybeConfig;
      } catch (e) {
        log.err("Failed to load flowpanel.config.ts:");
        log.err((e as Error).message);
        process.exit(1);
      }

      const adapter = config.adapter;
      if (
        !adapter ||
        typeof adapter.runMigrationSql !== "function" ||
        typeof adapter.listAppliedMigrations !== "function" ||
        typeof adapter.markMigrationApplied !== "function"
      ) {
        log.err(
          "Adapter does not support `flowpanel migrate`. Use `drizzleAdapter` or `prismaAdapter` from a FlowPanel ≥ this version.",
        );
        process.exit(1);
      }

      const applied = await adapter.listAppliedMigrations!();

      let ran = 0;
      for (const f of files) {
        const id = f.replace(/\.sql$/, "");
        if (applied.has(id)) {
          log.info(`${id} — already applied`);
          continue;
        }
        const sql = await fs.readFile(path.join(dir, f), "utf8");
        await adapter.runMigrationSql!(sql);
        await adapter.markMigrationApplied!(id);
        log.ok(`${id} applied`);
        ran++;
      }

      if (ran === 0) {
        p.outro(pc.dim("All migrations up to date."));
      } else {
        p.outro(pc.green(`${ran} migration${ran === 1 ? "" : "s"} applied`));
      }
    });
}
