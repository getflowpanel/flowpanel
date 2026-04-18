import kleur from "kleur";
import { loadConfig } from "../loadConfig";
import { formatSuccess } from "../utils/error-format";

export async function runDemoClear(): Promise<void> {
  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (err) {
    console.error(kleur.red(`Failed to load config: ${err}`));
    process.exit(1);
  }

  const db = await config.getDb();

  const result = await db.execute<{ id: bigint }>(
    `DELETE FROM flowpanel_pipeline_run WHERE is_demo = true RETURNING id`,
    [],
  );

  console.log(formatSuccess(`Cleared ${result.length} demo runs`));
  console.log(kleur.gray("  Re-seed at any time with: npx flowpanel init --seed"));
}
