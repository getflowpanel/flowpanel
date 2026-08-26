import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import {
  dashboardTemplateIntents,
  layoutTemplateIntents,
  resourceTemplateIntents,
} from "../eject/copyTargets";
import { editConfigToCommentDashboard, editConfigToCommentResource } from "../eject/editConfig";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent, FilesystemPlan } from "../plan/types";
import { detectAppDir, fileExists } from "../utils/detect";
import { CLI_VERSION, installedKitVersion, kitCompatibilityError } from "../utils/kit";
import { writeJson, writePlanJson } from "../utils/output";

/** Locate the user's flowpanel config, or `null` when the project has none yet. */
async function findConfigFile(
  cwd: string,
): Promise<{ path: string; filename: "flowpanel.config.ts" | "flowpanel.config.tsx" } | null> {
  for (const fname of ["flowpanel.config.ts", "flowpanel.config.tsx"] as const) {
    const full = path.join(cwd, fname);
    if (await fileExists(full)) return { path: full, filename: fname };
  }
  return null;
}

export type EjectTarget = "resource" | "dashboard" | "layout";

export interface RunEjectOptions {
  cwd: string;
  target: EjectTarget;
  name: string;
  version: string;
  force?: boolean;
}

export async function createEjectPlan(opts: RunEjectOptions): Promise<FilesystemPlan> {
  const mismatch = await kitCompatibilityError(opts.cwd);
  if (mismatch) throw new Error(mismatch);

  const cfg = await findConfigFile(opts.cwd);
  if (!cfg) {
    throw new Error(
      "flowpanel.config.ts not found. Run `flowpanel init` first — eject rewrites the config to hand rendering over to your files.",
    );
  }
  const appDir = await detectAppDir(opts.cwd);
  const source = await fs.readFile(cfg.path, "utf8");
  let intents: FileIntent[];

  if (opts.target === "resource") {
    if (!opts.name) {
      throw new Error("eject resource: <name> is required (e.g. `flowpanel eject resource users`)");
    }
    intents = await resourceTemplateIntents({
      cwd: opts.cwd,
      resourceName: opts.name,
      version: opts.version,
      ...(opts.force ? { force: true } : {}),
    });
    intents.push({
      path: path.relative(opts.cwd, cfg.path),
      content: editConfigToCommentResource(source, opts.name, cfg.filename, appDir),
      expectedContent: source,
    });
  } else if (opts.target === "dashboard") {
    if (!opts.name) {
      throw new Error(
        'eject dashboard: <path> is required (e.g. `flowpanel eject dashboard "/monitoring"`)',
      );
    }
    intents = await dashboardTemplateIntents({
      cwd: opts.cwd,
      dashboardPath: opts.name,
      version: opts.version,
      ...(opts.force ? { force: true } : {}),
    });
    intents.push({
      path: path.relative(opts.cwd, cfg.path),
      content: editConfigToCommentDashboard(source, opts.name, cfg.filename, appDir),
      expectedContent: source,
    });
  } else if (opts.target === "layout") {
    intents = await layoutTemplateIntents({
      cwd: opts.cwd,
      version: opts.version,
      ...(opts.force ? { force: true } : {}),
    });
  } else {
    throw new Error(`Unknown eject target: ${String(opts.target)}`);
  }

  return createFilesystemPlan(opts.cwd, intents);
}

/** Written files, relative to `cwd`. */
export async function runEject(opts: RunEjectOptions): Promise<string[]> {
  const plan = await createEjectPlan(opts);
  const written = await applyFilesystemPlan(plan);
  return written.filter((file) => !/^flowpanel\.config\.tsx?$/.test(file));
}

/** The kit version the ejected files were cut from; the CLI's own when kit isn't installed. */
export async function ejectVersion(cwd: string): Promise<string> {
  return (await installedKitVersion(cwd)) ?? CLI_VERSION;
}

export function ejectCommand(cli: Command): void {
  cli
    .command("eject <target> [name]")
    .description(
      "Eject a FlowPanel piece into your app/admin folder. Targets: resource <name>, dashboard <path>, layout.",
    )
    .option("--force", "Overwrite files if they already exist")
    .option("--dry-run", "Print the filesystem plan without writing")
    .option("--json", "Emit machine-readable JSON")
    .action(
      async (
        target: string,
        name: string | undefined,
        options: { force?: boolean; dryRun?: boolean; json?: boolean },
      ) => {
        if (!options.json) p.intro(pc.bgYellow(pc.black(" FlowPanel eject ")));

        const validTargets: ReadonlyArray<EjectTarget> = ["resource", "dashboard", "layout"];
        if (!validTargets.includes(target as EjectTarget)) {
          p.cancel(`Unknown target "${target}". Use one of: ${validTargets.join(", ")}`);
          process.exit(1);
        }

        const cwd = process.cwd();
        const version = await ejectVersion(cwd);

        try {
          const plan = await createEjectPlan({
            cwd,
            target: target as EjectTarget,
            name: name ?? "",
            version,
            ...(options.force ? { force: true } : {}),
          });
          if (options.dryRun) {
            if (options.json) writePlanJson("eject", plan, false);
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
          const written = await applyFilesystemPlan(plan);
          if (options.json) {
            writeJson({ command: "eject", applied: true, plan: publicPlan(plan) });
          } else {
            if (written.length > 0) p.note(written.join("\n"), "Wrote");
            p.outro(pc.green(`Ejected ${target}${name ? ` ${name}` : ""}`));
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (options.json) writeJson({ command: "eject", applied: false, error: msg });
          else p.cancel(`Failed: ${msg}`);
          process.exit(1);
        }
      },
    );
}
