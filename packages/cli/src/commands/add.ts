/**
 * `flowpanel add <widget>` — shadcn-style component scaffolder.
 *
 * Copies a widget template into the user's repo under
 * `src/flowpanel/widgets/<Name>.tsx`. The user edits directly — no
 * prop-drilling through an "overrides" API. Once copied, the file is
 * theirs to own.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as p from "@clack/prompts";
import type { Command } from "commander";
import pc from "picocolors";
import { renderWidgetTemplate, WIDGETS } from "./add/templates";

export function addCommand(cli: Command): void {
  cli
    .command("add <widget>")
    .description("Copy a widget template into src/flowpanel/widgets/")
    .option("--force", "Overwrite if the file already exists")
    .action(async (widget: string, opts: { force?: boolean }) => {
      p.intro(pc.bgBlue(pc.white(" flowpanel add ")));

      const template = WIDGETS[widget as keyof typeof WIDGETS];
      if (!template) {
        const list = Object.keys(WIDGETS)
          .map((k) => `  · ${k}`)
          .join("\n");
        p.cancel(pc.red(`Unknown widget "${widget}".\n\n`) + pc.dim(`Available widgets:\n${list}`));
        process.exit(1);
      }

      const target = join(process.cwd(), "src", "flowpanel", "widgets", template.filename);
      if (existsSync(target) && !opts.force) {
        p.cancel(
          pc.red(`Target already exists: ${target}\n`) +
            pc.dim("Pass --force to overwrite, or pick a different name."),
        );
        process.exit(1);
      }

      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, renderWidgetTemplate(widget, template));

      p.outro(
        pc.green(`✓ ${target}\n`) +
          pc.dim(`Edit freely — this file is yours. Import via:\n`) +
          pc.cyan(
            `  import { ${template.exportName} } from "@/flowpanel/widgets/${template.filename.replace(/\.tsx$/, "")}";`,
          ),
      );
    });
}
