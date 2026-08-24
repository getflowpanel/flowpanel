import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import { devCommand } from "./commands/dev.js";
import { doctorCommand } from "./commands/doctor.js";
import { ejectCommand } from "./commands/eject.js";
import { initCommand } from "./commands/init.js";
import { migrateCommand } from "./commands/migrate.js";
import { newCommand } from "./commands/new.js";
import { loadDotEnv } from "./utils/env.js";
import { reportFatal } from "./utils/fail.js";

loadDotEnv();

const cli = new Command()
  .name("flowpanel")
  .description("Admin panels the fast way")
  .version(pkg.version)
  .showSuggestionAfterError();

initCommand(cli);
migrateCommand(cli);
doctorCommand(cli);
ejectCommand(cli);
devCommand(cli);
newCommand(cli);

cli.parseAsync().catch((err) => {
  reportFatal(err);
  process.exit(1);
});
