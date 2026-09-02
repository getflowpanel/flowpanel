import { createProgram } from "./program";
import { loadDotEnv } from "./utils/env";
import { reportFatal } from "./utils/fail";

loadDotEnv();

createProgram()
  .parseAsync()
  .catch((err: unknown) => {
    reportFatal(err);
    process.exit(1);
  });
