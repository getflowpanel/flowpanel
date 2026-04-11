import path from "node:path";
import { flowPanelConfigSchema } from "@flowpanel/core";
import { createJiti } from "jiti";

export async function loadConfig(configPath?: string) {
  const jiti = createJiti(import.meta.url);
  const resolved = path.resolve(configPath ?? "flowpanel.config.ts");
  const mod = (await jiti.import(resolved)) as Record<string, unknown>;
  const raw = mod.default ?? mod.config ?? mod.flowpanel;
  return flowPanelConfigSchema.parse(raw);
}
