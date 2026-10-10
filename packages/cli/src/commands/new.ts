import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { editConfigToAddResource } from "../eject/add-resource";
import { findSplitResourcesDir } from "../eject/edit-config";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FilesystemPlan } from "../plan/types";
import { addPrismaResourceType, dirSpecifier, wireResourcesDir } from "../scaffold/config-edits";
import { findAdminConfig } from "../scaffold/config-target";
import { describeSchema } from "../scaffold/describe-schema";
import { planNewIntoDir } from "../scaffold/plan-new";
import { linkPrismaReferences, registeredPrismaNames } from "../scaffold/prisma-references";
import {
  describePrismaSchema,
  findPrismaModel,
  prismaResourceName,
} from "../scaffold/prisma-schema";
import { renderResourceEntry } from "../scaffold/render-resource";
import { checkSchemaExport } from "../scaffold/schema-export";
import { noConfigMessage } from "../utils/config-problem";
import { detectPackageManager, pmCommands } from "../utils/detect";
import { resolveProjectModule } from "../utils/module-path";
import { planLines, writeJson, writePlanJson } from "../utils/output";
import { noNextProject } from "../utils/project-root";
import { createUi, failCommand } from "../utils/ui";

export { checkSchemaExport };

export type AdapterKind = "drizzle" | "prisma";
export const ADAPTER_KINDS: ReadonlyArray<AdapterKind> = ["drizzle", "prisma"];

/** The default when `--kind` is absent; `null` for a value the flag does not accept. */
export function parseAdapterKind(raw: string | undefined): AdapterKind | null {
  if (raw === undefined) return "drizzle";
  return ADAPTER_KINDS.includes(raw as AdapterKind) ? (raw as AdapterKind) : null;
}

/** The adapter a config source builds, so `new` writes the entry that adapter takes. */
export function adapterKindOf(source: string): AdapterKind {
  return /\bprismaAdapter\s*\(/.test(source) ? "prisma" : "drizzle";
}

interface NewOptions {
  table?: string;
  kind?: string;
  dir?: string;
  hidden?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

function stop(opts: NewOptions, message: string): never {
  return failCommand("new", opts.json, message);
}

async function finish(
  plan: FilesystemPlan,
  opts: NewOptions,
  done: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const ui = createUi(opts.json);
  if (opts.dryRun) {
    if (opts.json) writePlanJson("new", plan, false, extra);
    else {
      ui.note(planLines(plan), "Filesystem plan (no changes applied)");
      ui.outro(pc.dim("Dry run complete."));
    }
    return;
  }
  await applyFilesystemPlan(plan);
  if (opts.json) writeJson({ command: "new", applied: true, plan: publicPlan(plan), ...extra });
  else ui.outro(pc.green(done));
}

/** `"<column> → <table>"` as `planNewIntoDir` reports it, parsed for the `--json` payload. */
export function unlinkedColumns(
  unlinked: readonly string[],
): Array<{ table: string; column: string }> {
  return unlinked.map((entry) => {
    const [column, table] = entry.split(" → ");
    return { table: table ?? "", column: column ?? "" };
  });
}

async function noConfig(cwd: string): Promise<string> {
  return noConfigMessage(cwd, pmCommands(await detectPackageManager(cwd)).dlx);
}

async function newIntoDir(cwd: string, resource: string, dir: string, opts: NewOptions) {
  if (opts.table !== undefined || parseAdapterKind(opts.kind) !== "drizzle") {
    stop(opts, "--dir reads your Drizzle schema, so it takes neither --table nor --kind prisma.");
  }
  const config = await findAdminConfig(cwd);
  if (!config) stop(opts, await noConfig(cwd));
  const configSource = await fs.readFile(config.file, "utf8");
  if (adapterKindOf(configSource) === "prisma") {
    stop(opts, "--dir writes Drizzle resource files. With Prisma, run new without --dir.");
  }
  const absoluteDir = path.resolve(cwd, dir);
  const shownDir = path.relative(cwd, absoluteDir) || ".";
  const { intents, unlinked } = await planNewIntoDir(cwd, resource, {
    dir,
    hidden: opts.hidden === true,
  });
  const index = path.join(absoluteDir, "index.ts");
  const importsDir = new Set<string>();
  for (const match of configSource.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = match[1] ?? "";
    if ((await resolveProjectModule(cwd, spec, config.file)) === index) importsDir.add(spec);
  }
  const wiring = wireResourcesDir(
    configSource,
    await dirSpecifier(cwd, config.file, absoluteDir),
    (spec) => importsDir.has(spec),
  );
  if (wiring.kind === "wired") {
    intents.push({
      path: path.relative(cwd, config.file),
      content: wiring.source,
      expectedContent: configSource,
    });
  }
  const plan = await createFilesystemPlan(cwd, intents);
  const conflicts = plan.operations.filter((operation) => operation.kind === "conflict");
  if (conflicts.length > 0) {
    stop(
      opts,
      `Nothing was written: ${conflicts.map((c) => c.path).join(", ")} already exists with other content.`,
    );
  }
  const ui = createUi(opts.json);
  if (unlinked.length > 0) {
    ui.info(
      `No reference on ${unlinked.join(", ")}: the target has no resource in ${shownDir} yet. Add it with new <table> --dir ${shownDir}, then set reference on those columns.`,
    );
  }
  if (wiring.kind === "manual") {
    ui.warn(
      `${path.relative(cwd, config.file)} does not read ${shownDir} yet. Add ${wiring.line}.`,
    );
  }
  const extra = {
    ...(unlinked.length > 0 ? { unlinked: unlinkedColumns(unlinked) } : {}),
    ...(wiring.kind === "manual" ? { wiring: wiring.line } : {}),
  };
  await finish(plan, opts, `Added resource "${resource}" to ${shownDir}`, extra);
}

/** The entry `new` writes for a Drizzle table: columns, search, filters and sort, read from the schema. */
async function drizzleEntry(
  cwd: string,
  configFile: string,
  configSource: string,
  exportName: string,
  hidden: boolean,
): Promise<{ entry: string } | { reason: string }> {
  const spec = /import\s+\*\s+as\s+schema\s+from\s+["']([^"']+)["']/.exec(configSource)?.[1];
  const file = spec ? await resolveProjectModule(cwd, spec, configFile) : null;
  if (!file) return { reason: "the config's schema import does not resolve to a file" };
  try {
    const tables = await describeSchema(cwd, file);
    const table = tables.find((t) => t.exportName === exportName);
    if (!table) return { reason: `${exportName} is not a Drizzle table` };
    const registered = new Set(
      [...configSource.matchAll(/resource\(\s*schema\.(\w+)/g)].map((m) => m[1] ?? ""),
    );
    const columns = table.columns.map((column) => {
      const target = column.references?.table;
      if (!target || target === table.tableName) return column;
      if (tables.some((t) => t.tableName === target && registered.has(t.exportName))) {
        return column;
      }
      const { references: _references, ...plain } = column;
      return plain;
    });
    return {
      entry: renderResourceEntry({ ...table, columns }, `schema.${exportName}`, { hidden }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { reason: message.split("\n")[0] ?? message };
  }
}

export function newCommand(cli: Command): void {
  cli
    .command("new <resource>")
    .description("Add a resource for a table or model to the admin config")
    .option(
      "--table <expr>",
      "The resource's first argument, as code (default: schema.<resource> on Drizzle, the model name on Prisma)",
    )
    .option("--kind <kind>", "Adapter kind: drizzle or prisma (default: the config's adapter)")
    .option("--dir <dir>", "Write the resource to <dir>/<name>.ts and add it to <dir>/index.ts")
    .option("--hidden", "Register the resource without a navigation entry")
    .option("--dry-run", "Print the filesystem plan without writing")
    .option("--json", "Emit machine-readable JSON")
    .action(async (resource: string, opts: NewOptions) => {
      const ui = createUi(opts.json);
      ui.intro(pc.bgGreen(pc.black(" FlowPanel new ")));
      const cwd = process.cwd();
      const notProject = await noNextProject(cwd);
      if (notProject) stop(opts, notProject);
      try {
        if (opts.dir !== undefined) {
          await newIntoDir(cwd, resource, opts.dir, opts);
          return;
        }
        const requested = parseAdapterKind(opts.kind);
        if (requested === null) {
          stop(opts, `Unknown --kind "${opts.kind}". Use one of: ${ADAPTER_KINDS.join(", ")}`);
        }
        const found = await findAdminConfig(cwd);
        if (!found) stop(opts, await noConfig(cwd));
        const source = await fs.readFile(found.file, "utf8");
        const kind = opts.kind === undefined ? adapterKindOf(source) : requested;
        const splitDir = await findSplitResourcesDir(cwd, found.file, source);
        if (splitDir && kind === "drizzle" && opts.table === undefined) {
          await newIntoDir(cwd, resource, path.relative(cwd, splitDir) || ".", opts);
          return;
        }
        const hidden = opts.hidden === true;
        let resourceName = resource;
        let entry: string | undefined;
        let prismaName: string | null = null;
        if (kind === "drizzle" && opts.table === undefined) {
          const check = await checkSchemaExport(cwd, found.file, source, resource);
          if (check.status === "missing") stop(opts, check.message);
          if (check.status === "ok") {
            resourceName = check.exportName;
            const rendered = await drizzleEntry(cwd, found.file, source, resourceName, hidden);
            if ("entry" in rendered) entry = rendered.entry;
            else {
              ui.warn(
                `Could not read the columns of "${resourceName}" (${rendered.reason}), so the entry lists every column.`,
              );
            }
          }
          if (check.status === "unverified") {
            ui.warn(
              `Could not verify that "${resource}" is a real table: ${check.reason}. Writing the entry anyway; check that it compiles.`,
            );
          }
        }
        if (kind === "prisma" && opts.table === undefined) {
          const models = await describePrismaSchema(cwd);
          if (models.length === 0) {
            ui.warn("Could not find schema.prisma, so the model name is not checked.");
          } else {
            const model = findPrismaModel(models, resource);
            if (!model) {
              stop(
                opts,
                `schema.prisma has no model named "${resource}".\nModels: ${models.map((m) => m.exportName).join(", ")}`,
              );
            }
            if (model.exportName !== resource) {
              ui.info(`Using the ${model.exportName} model for "${resource}".`);
            }
            resourceName = model.exportName;
            prismaName = prismaResourceName(model);
            entry = renderResourceEntry(
              linkPrismaReferences(model, prismaName, registeredPrismaNames(source)),
              JSON.stringify(model.exportName),
              { hidden, ...(prismaName === model.exportName ? {} : { name: prismaName }) },
            );
          }
        }
        const relative = path.relative(cwd, found.file);
        const added = editConfigToAddResource(source, resourceName, {
          ...(opts.table !== undefined ? { table: opts.table } : {}),
          ...(entry !== undefined ? { entry } : {}),
          ...(hidden ? { hidden: true } : {}),
          kind,
          filename: relative,
        });
        const updated = prismaName ? addPrismaResourceType(added, prismaName, resourceName) : added;
        const plan = await createFilesystemPlan(cwd, [
          { path: relative, content: updated, expectedContent: source },
        ]);
        await finish(plan, opts, `Added resource "${prismaName ?? resourceName}" to ${relative}`);
      } catch (e: unknown) {
        stop(opts, e instanceof Error ? e.message : String(e));
      }
    });
}
