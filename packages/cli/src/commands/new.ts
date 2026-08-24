import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { editConfigToAddResource } from "../eject/addResource.js";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan.js";
import { applyFilesystemPlan } from "../plan/transaction.js";
import { fileExists } from "../utils/detect.js";
import { writeJson, writePlanJson } from "../utils/output.js";

/** Locate the user's flowpanel config. */
async function findConfigFile(
  cwd: string,
): Promise<{ path: string; filename: "flowpanel.config.ts" | "flowpanel.config.tsx" } | null> {
  for (const fname of ["flowpanel.config.ts", "flowpanel.config.tsx"] as const) {
    const full = path.join(cwd, fname);
    if (await fileExists(full)) return { path: full, filename: fname };
  }
  return null;
}

/** Resolve the module specifier a config imports its schema from to a file on disk. */
async function resolveSchemaFile(cwd: string, spec: string): Promise<string | null> {
  const bare = spec.startsWith("@/")
    ? spec.slice(2)
    : spec.startsWith("./") || spec.startsWith("../")
      ? spec
      : null;
  if (bare === null) return null;
  const roots = spec.startsWith("@/") ? [path.join(cwd, "src"), cwd] : [cwd];
  for (const root of roots) {
    for (const suffix of [".ts", ".tsx", "/index.ts", ""]) {
      const candidate = path.join(root, `${bare}${suffix}`);
      if (await fileExists(candidate)) {
        return (await fs.stat(candidate)).isFile() ? candidate : null;
      }
    }
  }
  return null;
}

/** Names a module exports, as far as a source scan can tell. */
function exportedNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(
    /export\s+(?:declare\s+)?(?:const|let|var|function|class)\s+(\w+)/g,
  )) {
    names.add(m[1] as string);
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of (m[1] as string).split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

type SchemaCheck =
  | { status: "ok" }
  | { status: "missing"; message: string }
  | { status: "unverified"; reason: string };

/**
 * Checks the resource maps to a real table before writing it into the config —
 * otherwise `flowpanel new` happily produces a line that cannot compile.
 */
async function checkSchemaExport(
  cwd: string,
  configSource: string,
  name: string,
): Promise<SchemaCheck> {
  const importMatch = /import\s+\*\s+as\s+schema\s+from\s+["']([^"']+)["']/.exec(configSource);
  if (!importMatch) {
    return { status: "unverified", reason: "the config has no `import * as schema` line" };
  }
  const spec = importMatch[1] as string;
  const file = await resolveSchemaFile(cwd, spec);
  if (!file) {
    return { status: "unverified", reason: `"${spec}" does not resolve to a file under ${cwd}` };
  }
  const names = exportedNames(await fs.readFile(file, "utf8"));
  if (names.size === 0) {
    return {
      status: "unverified",
      reason: `no exports could be read from ${path.relative(cwd, file)}`,
    };
  }
  if (names.has(name)) return { status: "ok" };
  const available = [...names].sort().slice(0, 12).join(", ");
  return {
    status: "missing",
    message:
      `${path.relative(cwd, file)} has no export named "${name}".\n` +
      (available ? `Exports there: ${available}\n` : "") +
      `Pass the table expression yourself with --table if it lives elsewhere.`,
  };
}

export function newCommand(cli: Command): void {
  cli
    .command("new <resource>")
    .description("Add a resource(...) entry to flowpanel.config.ts")
    .option("--table <expr>", "First argument expression (default: schema.<resource>)")
    .option("--kind <kind>", "Adapter kind: drizzle (default) or prisma", "drizzle")
    .option("--dry-run", "Print the filesystem plan without writing")
    .option("--json", "Emit machine-readable JSON")
    .action(
      async (
        resource: string,
        opts: { table?: string; kind?: string; dryRun?: boolean; json?: boolean },
      ) => {
        if (!opts.json) p.intro(pc.bgGreen(pc.black(" FlowPanel new ")));

        const cwd = process.cwd();
        const found = await findConfigFile(cwd);
        if (!found) {
          const message = "flowpanel.config.ts not found — run `flowpanel init` first.";
          if (opts.json) writeJson({ command: "new", applied: false, error: message });
          else p.cancel(message);
          process.exit(1);
        }

        const source = await fs.readFile(found.path, "utf8");
        const kind = opts.kind === "prisma" ? "prisma" : "drizzle";

        if (kind === "drizzle" && opts.table === undefined) {
          const check = await checkSchemaExport(cwd, source, resource);
          if (check.status === "missing") {
            if (opts.json) writeJson({ command: "new", applied: false, error: check.message });
            else p.cancel(check.message);
            process.exit(1);
          }
          if (check.status === "unverified" && !opts.json) {
            p.log.warn(
              `Could not verify that "${resource}" is a real table — ${check.reason}.\n` +
                "Writing the entry anyway; check that it compiles.",
            );
          }
        }

        try {
          const updated = editConfigToAddResource(source, resource, {
            ...(opts.table !== undefined ? { table: opts.table } : {}),
            kind,
            filename: found.filename,
          });
          const plan = await createFilesystemPlan(cwd, [
            {
              path: path.relative(cwd, found.path),
              content: updated,
              expectedContent: source,
            },
          ]);
          if (opts.dryRun) {
            if (opts.json) writePlanJson("new", plan, false);
            else {
              p.note(
                publicPlan(plan)
                  .operations.map((operation) => `${operation.kind.padEnd(6)} ${operation.path}`)
                  .join("\n"),
                "Filesystem plan (no changes applied)",
              );
              p.outro(pc.dim("Dry run complete."));
            }
            return;
          }
          await applyFilesystemPlan(plan);
          if (opts.json) writeJson({ command: "new", applied: true, plan: publicPlan(plan) });
          else p.outro(pc.green(`Added resource "${resource}" to ${found.filename}`));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (opts.json) writeJson({ command: "new", applied: false, error: msg });
          else p.cancel(`Failed: ${msg}`);
          process.exit(1);
        }
      },
    );
}
