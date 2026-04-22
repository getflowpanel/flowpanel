// Node.js version guard — must be before imports
const [major] = process.versions.node.split(".").map(Number);
if (major !== undefined && major < 20) {
  console.error(
    `FlowPanel requires Node.js 20 or later. Current: ${process.version}\nUpgrade: https://nodejs.org/`,
  );
  process.exit(1);
}

import { Command } from "commander";
import { doctorCommand } from "./commands/doctor";
import { initCommand } from "./commands/init";
import { scaffoldCommand } from "./commands/scaffold";

const program = new Command().name("flowpanel").description("FlowPanel CLI").version("0.1.0");

initCommand(program);
scaffoldCommand(program);
doctorCommand(program);

program.parse();
