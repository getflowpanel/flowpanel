import { buildStyles } from "./build-styles.mjs";
import { INTERNAL_PACKAGES, vendor } from "./vendor.mjs";

const { copied, problems } = vendor();
if (problems.length) {
  console.error(`✗ the kit is not self-contained (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
await buildStyles();
console.log(`✔ vendored ${INTERNAL_PACKAGES.length} packages (${copied.length} files) into dist/`);
