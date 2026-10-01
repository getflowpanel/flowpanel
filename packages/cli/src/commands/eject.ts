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
import {
  editConfigToCommentDashboard,
  editConfigToCommentResource,
  editSplitResourceFile,
  findSplitResourcesDir,
} from "../eject/editConfig";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent, FilesystemPlan } from "../plan/types";
import { findAdminConfig } from "../scaffold/config-target";
import { detectAppDir } from "../utils/detect";
import { CLI_VERSION, installedKitVersion, kitCompatibilityError } from "../utils/kit";
import { writeJson, writePlanJson } from "../utils/output";
import { noNextProject } from "../utils/project-root";

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

  const cfg = await findAdminConfig(opts.cwd);
  if (!cfg) {
    throw new Error(
      "flowpanel.config.ts not found. Run `flowpanel init` first — eject rewrites the config to hand rendering over to your files.",
    );
  }
  const appDir = await detectAppDir(opts.cwd);
  const source = await fs.readFile(cfg.file, "utf8");
  const configFilename = path.basename(cfg.file);
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
    try {
      intents.push({
        path: path.relative(opts.cwd, cfg.file),
        content: editConfigToCommentResource(source, opts.name, configFilename, appDir),
        expectedContent: source,
      });
    } catch {
      const splitDir = await findSplitResourcesDir(opts.cwd, cfg.file, source);
      const found = splitDir ? await editSplitResourceFile(splitDir, opts.name, appDir) : null;
      if (!found) {
        const searched = splitDir
          ? `${path.relative(opts.cwd, cfg.file)} or ${path.relative(opts.cwd, splitDir)}`
          : path.relative(opts.cwd, cfg.file);
        throw new Error(`eject: resource "${opts.name}" not found in ${searched}`);
      }
      intents.push({
        path: path.relative(opts.cwd, found.file),
        content: found.edited,
        expectedContent: found.source,
      });
    }
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
      path: path.relative(opts.cwd, cfg.file),
      content: editConfigToCommentDashboard(source, opts.name, configFilename, appDir),
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
          const msg = `Unknown target "${target}". Use one of: ${validTargets.join(", ")}`;
          if (options.json) writeJson({ command: "eject", applied: false, error: msg });
          else p.cancel(msg);
          process.exit(1);
        }

        const cwd = process.cwd();
        const notProject = await noNextProject(cwd);
        if (notProject) {
          if (options.json) writeJson({ command: "eject", applied: false, error: notProject });
          else p.cancel(notProject);
          process.exit(1);
        }
        const version = await ejectVersion(cwd);

        try {
          const plan = await createEjectPlan({
            cwd,
            target: target as EjectTarget,
            name: name ?? "",
            version,
            ...(options.force ? { force: true } : {}),
          });
          const conflicted = plan.operations.some((operation) => operation.kind === "conflict");
          const planLines = publicPlan(plan)
            .operations.map((operation) => `${operation.kind.padEnd(6)} ${operation.path}`)
            .join("\n");
          if (options.dryRun) {
            if (options.json) writePlanJson("eject", plan, false);
            else {
              p.note(planLines, "Filesystem plan (no changes applied)");
              if (conflicted) p.log.warn("Use --force to overwrite.");
              p.outro(pc.dim("Dry run complete."));
            }
            return;
          }
          if (conflicted && !options.json) {
            p.note(planLines, "Filesystem plan");
            p.cancel("Nothing was written. Use --force to overwrite.");
            process.exit(1);
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
