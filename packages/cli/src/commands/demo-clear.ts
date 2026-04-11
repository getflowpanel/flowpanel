import * as path from "node:path";
import kleur from "kleur";
import { formatSuccess } from "../utils/error-format.js";

export async function runDemoClear(): Promise<void> {
  const cwd = process.cwd();

  let config: any;
  try {
    config = (await import(path.join(cwd, "flowpanel.config.ts"))).flowpanel;
  } catch (err) {
    console.error(kleur.red(`Failed to load config: ${err}`));
    process.exit(1);
  }

  const db = await config.getDb();

  const result = (await db.execute(
    `DELETE FROM flowpanel_pipeline_run WHERE is_demo = true RETURNING id`,
    [],
  )) as Array<{ id: bigint }>;

  console.log(formatSuccess(`Cleared ${result.length} demo runs`));
  console.log(kleur.gray("  Re-seed at any time with: npx flowpanel init --seed"));
}
