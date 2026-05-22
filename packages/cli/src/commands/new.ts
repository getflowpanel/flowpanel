import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { editConfigToAddResource } from "../eject/addResource.js";
import { fileExists } from "../utils/detect.js";

/**
 * Locate the user's flowpanel config. Tries `.ts` first, falls back to `.tsx`
 * — the latter is legitimate when the config embeds sidecar JSX.
 */
async function findConfigFile(
  cwd: string,
): Promise<{ path: string; filename: "flowpanel.config.ts" | "flowpanel.config.tsx" } | null> {
  for (const fname of ["flowpanel.config.ts", "flowpanel.config.tsx"] as const) {
    const full = path.join(cwd, fname);
    if (await fileExists(full)) return { path: full, filename: fname };
  }
  return null;
}

export function newCommand(cli: Command): void {
  cli
    .command("new <resource>")
    .description("Add a resource(...) entry to flowpanel.config.ts")
    .option("--table <expr>", "First argument expression (default: schema.<resource>)")
    .option("--kind <kind>", "Adapter kind: drizzle (default) or prisma", "drizzle")
    .action(async (resource: string, opts: { table?: string; kind?: string }) => {
      p.intro(pc.bgGreen(pc.black(" FlowPanel new ")));

      const cwd = process.cwd();
      const found = await findConfigFile(cwd);
      if (!found) {
        p.cancel("flowpanel.config.ts not found — run `flowpanel init` first.");
        process.exit(1);
      }

      const source = await fs.readFile(found.path, "utf8");
      const kind = opts.kind === "prisma" ? "prisma" : "drizzle";

      try {
        const updated = editConfigToAddResource(source, resource, {
          ...(opts.table !== undefined ? { table: opts.table } : {}),
          kind,
          filename: found.filename,
        });
        await fs.writeFile(found.path, updated, "utf8");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        p.cancel(`Failed: ${msg}`);
        process.exit(1);
      }

      p.outro(pc.green(`Added resource "${resource}" to ${found.filename}`));
    });
}
