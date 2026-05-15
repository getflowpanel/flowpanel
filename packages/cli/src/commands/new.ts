import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { editConfigToAddResource } from "../eject/addResource.js";

export function newCommand(cli: Command): void {
  cli
    .command("new <resource>")
    .description("Add a resource(...) entry to flowpanel.config.ts")
    .option("--table <expr>", "First argument expression (default: schema.<resource>)")
    .option("--kind <kind>", "Adapter kind: drizzle (default) or prisma", "drizzle")
    .action(async (resource: string, opts: { table?: string; kind?: string }) => {
      p.intro(pc.bgGreen(pc.black(" FlowPanel new ")));

      const cwd = process.cwd();
      const cfgPath = path.join(cwd, "flowpanel.config.ts");

      let source: string;
      try {
        source = await fs.readFile(cfgPath, "utf8");
      } catch {
        p.cancel("flowpanel.config.ts not found — run `flowpanel init` first.");
        process.exit(1);
      }

      const kind = opts.kind === "prisma" ? "prisma" : "drizzle";

      try {
        const updated = editConfigToAddResource(source, resource, {
          ...(opts.table !== undefined ? { table: opts.table } : {}),
          kind,
        });
        await fs.writeFile(cfgPath, updated, "utf8");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        p.cancel(`Failed: ${msg}`);
        process.exit(1);
      }

      p.outro(pc.green(`Added resource "${resource}" to flowpanel.config.ts`));
    });
}
