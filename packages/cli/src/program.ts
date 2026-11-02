import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import { devCommand } from "./commands/dev";
import { doctorCommand } from "./commands/doctor";
import { ejectCommand } from "./commands/eject";
import { initCommand } from "./commands/init";
import { migrateCommand } from "./commands/migrate";
import { newCommand } from "./commands/new";

export function createProgram(): Command {
  const program = new Command()
    .name("flowpanel")
    .description("Add a typed admin panel to a Next.js app")
    .version(pkg.version, "-V, --version", "Print the version")
    .helpOption("-h, --help", "Show help")
    .helpCommand("help [command]", "Show help for a command")
    .showSuggestionAfterError()
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  pnpm dlx @flowpanel/cli init     set up the admin in this Next.js app",
        "  pnpm flowpanel new users         add a resource for the users table",
        "  pnpm flowpanel doctor            check the setup",
        "",
        "Docs: https://flowpanel.tech/docs/reference/cli",
      ].join("\n"),
    );

  initCommand(program);
  newCommand(program);
  devCommand(program);
  migrateCommand(program);
  doctorCommand(program);
  ejectCommand(program);

  return program;
}
