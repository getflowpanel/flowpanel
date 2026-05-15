import { Command } from "commander";
import { devCommand } from "./commands/dev.js";
import { doctorCommand } from "./commands/doctor.js";
import { ejectCommand } from "./commands/eject.js";
import { initCommand } from "./commands/init.js";
import { migrateCommand } from "./commands/migrate.js";
import { newCommand } from "./commands/new.js";

const cli = new Command()
  .name("flowpanel")
  .description("Admin panels the fast way")
  .version("0.1.0-alpha.0");

initCommand(cli);
migrateCommand(cli);
doctorCommand(cli);
ejectCommand(cli);
devCommand(cli);
newCommand(cli);

cli.parse();
