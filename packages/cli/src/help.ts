import { existsSync } from "node:fs";
import { resolve } from "node:path";
import kleur from "kleur";

export function showContextualHelp() {
  const hasConfig =
    existsSync(resolve("flowpanel.config.ts")) || existsSync(resolve("flowpanel.config.js"));

  console.log();
  console.log(`  ${kleur.cyan("◆")} ${kleur.bold("FlowPanel")} ${kleur.dim("v0.1.0")}`);

  if (hasConfig) {
    console.log();
    console.log(`  ${kleur.bold("Commands")}`);
    console.log(`    ${kleur.cyan("migrate")}    Sync database with config`);
    console.log(`    ${kleur.cyan("doctor")}     Check setup and troubleshoot`);
    console.log(`    ${kleur.cyan("demo")}       Try FlowPanel with sample data`);
    console.log();
    console.log(kleur.dim("  flowpanel <command> --help for details"));
  } else {
    console.log();
    console.log(`  ${kleur.bold("Get started")}:  ${kleur.cyan("flowpanel demo")}`);
    console.log();
    console.log(`  ${kleur.bold("Commands")}`);
    console.log(`    ${kleur.cyan("demo")}       Try FlowPanel with sample data`);
    console.log(`    ${kleur.cyan("init")}       Add FlowPanel to your project`);
    console.log(`    ${kleur.cyan("migrate")}    Sync database with config`);
    console.log(`    ${kleur.cyan("doctor")}     Check setup and troubleshoot`);
    console.log();
    console.log(kleur.dim("  flowpanel.tech"));
  }
  console.log();
}
