import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import {
  copyDashboardTemplate,
  copyLayoutTemplate,
  copyResourceTemplates,
} from "../eject/copyTargets.js";
import { editConfigToCommentDashboard, editConfigToCommentResource } from "../eject/editConfig.js";
import { detectAppDir, fileExists } from "../utils/detect.js";

/** Locate the user's flowpanel config. */
async function findConfigFile(
  cwd: string,
): Promise<{ path: string; filename: "flowpanel.config.ts" | "flowpanel.config.tsx" }> {
  for (const fname of ["flowpanel.config.ts", "flowpanel.config.tsx"] as const) {
    const full = path.join(cwd, fname);
    if (await fileExists(full)) return { path: full, filename: fname };
  }
  return { path: path.join(cwd, "flowpanel.config.ts"), filename: "flowpanel.config.ts" };
}

export type EjectTarget = "resource" | "dashboard" | "layout";

export interface RunEjectOptions {
  cwd: string;
  target: EjectTarget;
  name: string;
  version: string;
  force?: boolean;
}

export async function runEject(opts: RunEjectOptions): Promise<void> {
  const cfg = await findConfigFile(opts.cwd);
  const appDir = await detectAppDir(opts.cwd);

  if (opts.target === "resource") {
    if (!opts.name) {
      throw new Error("eject resource: <name> is required (e.g. `flowpanel eject resource users`)");
    }
    await copyResourceTemplates({
      cwd: opts.cwd,
      resourceName: opts.name,
      version: opts.version,
      ...(opts.force ? { force: true } : {}),
    });
    const source = await fs.readFile(cfg.path, "utf8");
    const updated = editConfigToCommentResource(source, opts.name, cfg.filename, appDir);
    await fs.writeFile(cfg.path, updated, "utf8");
    return;
  }

  if (opts.target === "dashboard") {
    if (!opts.name) {
      throw new Error(
        'eject dashboard: <path> is required (e.g. `flowpanel eject dashboard "/monitoring"`)',
      );
    }
    await copyDashboardTemplate({
      cwd: opts.cwd,
      dashboardPath: opts.name,
      version: opts.version,
      ...(opts.force ? { force: true } : {}),
    });
    const source = await fs.readFile(cfg.path, "utf8");
    const updated = editConfigToCommentDashboard(source, opts.name, cfg.filename, appDir);
    await fs.writeFile(cfg.path, updated, "utf8");
    return;
  }

  if (opts.target === "layout") {
    await copyLayoutTemplate({
      cwd: opts.cwd,
      version: opts.version,
      ...(opts.force ? { force: true } : {}),
    });
    return;
  }

  throw new Error(`Unknown eject target: ${String(opts.target)}`);
}

async function readPackageVersion(cwd: string): Promise<string> {
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(cwd, "node_modules/@flowpanel/kit/package.json"), "utf8"),
    );
    if (typeof pkg?.version === "string") return pkg.version;
  } catch {
    /* fall through */
  }
  return "1.0.0";
}

export function ejectCommand(cli: Command): void {
  cli
    .command("eject <target> [name]")
    .description(
      "Eject a FlowPanel piece into your app/admin folder. Targets: resource <name>, dashboard <path>, layout.",
    )
    .option("--force", "Overwrite files if they already exist")
    .action(async (target: string, name: string | undefined, options: { force?: boolean }) => {
      p.intro(pc.bgYellow(pc.black(" FlowPanel eject ")));

      const validTargets: ReadonlyArray<EjectTarget> = ["resource", "dashboard", "layout"];
      if (!validTargets.includes(target as EjectTarget)) {
        p.cancel(`Unknown target "${target}". Use one of: ${validTargets.join(", ")}`);
        process.exit(1);
      }

      const cwd = process.cwd();
      const version = await readPackageVersion(cwd);

      try {
        await runEject({
          cwd,
          target: target as EjectTarget,
          name: name ?? "",
          version,
          ...(options.force ? { force: true } : {}),
        });
        p.outro(pc.green(`Ejected ${target}${name ? ` ${name}` : ""}`));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        p.cancel(`Failed: ${msg}`);
        process.exit(1);
      }
    });
}
