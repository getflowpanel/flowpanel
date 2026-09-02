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
    .description("Admin panels the fast way")
    .version(pkg.version)
    .showSuggestionAfterError();

  initCommand(program);
  migrateCommand(program);
  doctorCommand(program);
  ejectCommand(program);
  devCommand(program);
  newCommand(program);

  return program;
}
