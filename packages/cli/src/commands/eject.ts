import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import {
  dashboardTemplateIntents,
  layoutTemplateIntents,
  resourceTemplateIntents,
} from "../eject/copy-targets";
import {
  definesResource,
  editConfigToCommentDashboard,
  findSplitResourceFile,
  findSplitResourcesDir,
} from "../eject/edit-config";
import { createFilesystemPlan, publicPlan } from "../plan/filesystem-plan";
import { applyFilesystemPlan } from "../plan/transaction";
import type { FileIntent, FilesystemPlan } from "../plan/types";
import { findAdminConfig } from "../scaffold/config-target";
import { readAdminMount } from "../utils/admin-path";
import { configProblem, noConfigMessage } from "../utils/config-problem";
import { detectAppDir, detectPackageManager, pmCommands } from "../utils/detect";
import { CLI_VERSION, installedKitVersion, kitCompatibilityError } from "../utils/kit";
import { planLines, writeJson, writePlanJson } from "../utils/output";
import { noNextProject } from "../utils/project-root";
import { createUi, failCommand } from "../utils/ui";

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
      noConfigMessage(opts.cwd, pmCommands(await detectPackageManager(opts.cwd)).dlx),
    );
  }
  const mount = await readAdminMount(opts.cwd);
  if (mount.error) throw new Error(mount.error);
  const adminPath = mount.path ?? "/admin";
  const appDir = await detectAppDir(opts.cwd);
  const source = await fs.readFile(cfg.file, "utf8");
  const configFilename = path.basename(cfg.file);
  const common = {
    cwd: opts.cwd,
    version: opts.version,
    adminPath,
    ...(opts.force ? { force: true } : {}),
  };
  let intents: FileIntent[];

  if (opts.target === "resource") {
    if (!opts.name) {
      throw new Error("eject resource: <name> is required (e.g. `flowpanel eject resource users`)");
    }
    if (!definesResource(source, opts.name, configFilename)) {
      const splitDir = await findSplitResourcesDir(opts.cwd, cfg.file, source);
      const file = splitDir ? await findSplitResourceFile(splitDir, opts.name) : null;
      if (!file) {
        const searched = splitDir
          ? `${path.relative(opts.cwd, cfg.file)} or ${path.relative(opts.cwd, splitDir)}`
          : path.relative(opts.cwd, cfg.file);
        throw new Error(configProblem("resources", `no resource "${opts.name}" in ${searched}.`));
      }
    }
    intents = await resourceTemplateIntents({ ...common, resourceName: opts.name });
  } else if (opts.target === "dashboard") {
    if (!opts.name) {
      throw new Error(
        'eject dashboard: <path> is required (e.g. `flowpanel eject dashboard "/monitoring"`)',
      );
    }
    intents = await dashboardTemplateIntents({ ...common, dashboardPath: opts.name });
    intents.push({
      path: path.relative(opts.cwd, cfg.file),
      content: editConfigToCommentDashboard(source, opts.name, configFilename, appDir, adminPath),
      expectedContent: source,
    });
  } else if (opts.target === "layout") {
    intents = await layoutTemplateIntents(common);
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
      "Copy resource <name>, dashboard <path> or layout into your admin folder as code you own",
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
        const ui = createUi(options.json);
        ui.intro(pc.bgYellow(pc.black(" FlowPanel eject ")));
        const fail: (message: string) => never = (message) =>
          failCommand("eject", options.json, message);

        const validTargets: ReadonlyArray<EjectTarget> = ["resource", "dashboard", "layout"];
        if (!validTargets.includes(target as EjectTarget)) {
          fail(`Unknown target "${target}". Use one of: ${validTargets.join(", ")}`);
        }

        const cwd = process.cwd();
        const notProject = await noNextProject(cwd);
        if (notProject) fail(notProject);
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
          if (options.dryRun) {
            if (options.json) writePlanJson("eject", plan, false);
            else {
              ui.note(planLines(plan), "Filesystem plan (no changes applied)");
              if (conflicted) ui.warn("Use --force to overwrite.");
              ui.outro(pc.dim("Dry run complete."));
            }
            return;
          }
          if (conflicted && !options.json) {
            ui.note(planLines(plan), "Filesystem plan");
            fail("Nothing was written. Use --force to overwrite.");
          }
          const written = await applyFilesystemPlan(plan);
          if (options.json) {
            writeJson({ command: "eject", applied: true, plan: publicPlan(plan) });
            return;
          }
          if (written.length > 0) ui.note(written.join("\n"), "Wrote");
          if (target === "resource") {
            ui.info(
              `flowpanel.config.ts still registers ${name}: the ejected pages read and write rows through it.`,
            );
          }
          if (target === "layout") {
            ui.info(
              'Set shell: "bare" in flowpanel.config.ts so the pages do not render a second shell.',
            );
          }
          ui.outro(pc.green(`Ejected ${target}${name ? ` ${name}` : ""}`));
        } catch (e: unknown) {
          fail(e instanceof Error ? e.message : String(e));
        }
      },
    );
}
