import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { copyResourceTemplates } from "../eject/copyTargets.js";
import { editConfigToCommentResource } from "../eject/editConfig.js";

export type EjectTarget = "resource" | "dashboard" | "layout";

export interface RunEjectOptions {
  cwd: string;
  target: EjectTarget;
  name: string;
  version: string;
  force?: boolean;
}

export async function runEject(opts: RunEjectOptions): Promise<void> {
  if (opts.target === "resource") {
    if (!opts.name) throw new Error("eject resource: name is required");
    await copyResourceTemplates({
      cwd: opts.cwd,
      resourceName: opts.name,
      version: opts.version,
      ...(opts.force ? { force: true } : {}),
    });
    const cfgPath = path.join(opts.cwd, "flowpanel.config.ts");
    const cfg = await fs.readFile(cfgPath, "utf8");
    const updated = editConfigToCommentResource(cfg, opts.name);
    await fs.writeFile(cfgPath, updated, "utf8");
    return;
  }
  if (opts.target === "dashboard" || opts.target === "layout") {
    throw new Error(
      `eject ${opts.target}: not yet implemented (M4a ships resource only; dashboard + layout land in a follow-up)`,
    );
  }
  throw new Error(`Unknown eject target: ${String(opts.target)}`);
}

async function readPackageVersion(cwd: string): Promise<string> {
  // Try the consumer's flowpanel install; fall back to a sensible default.
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(cwd, "node_modules/flowpanel/package.json"), "utf8"),
    );
    if (typeof pkg?.version === "string") return pkg.version;
  } catch {
    /* fall through */
  }
  return "1.0.0-beta.0";
}

export function ejectCommand(cli: Command): void {
  cli
    .command("eject <target> [name]")
    .description("Eject a FlowPanel piece into your app/admin folder (resource only in M4a)")
    .option("--force", "Overwrite files if they already exist")
    .action(async (target: string, name: string | undefined, options: { force?: boolean }) => {
      p.intro(pc.bgYellow(pc.black(" FlowPanel eject ")));
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
