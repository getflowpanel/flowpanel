import { Command } from "commander";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { migrateCommand } from "./commands/migrate.js";

const cli = new Command()
  .name("flowpanel")
  .description("Admin panels the fast way")
  .version("0.1.0-alpha.0");

initCommand(cli);
migrateCommand(cli);
doctorCommand(cli);

cli.parse();
