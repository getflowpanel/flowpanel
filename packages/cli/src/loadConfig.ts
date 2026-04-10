import path from "node:path";
import type { FlowPanelConfig } from "@flowpanel/core";

export async function loadConfig(configPath?: string): Promise<FlowPanelConfig> {
	const resolved = path.resolve(configPath ?? "flowpanel.config.ts");
	const mod: unknown = await import(`${resolved}?t=${Date.now()}`);

	if (typeof mod !== "object" || mod === null) {
		throw new Error(`Config file must export an object: ${resolved}`);
	}

	const raw = (mod as Record<string, unknown>).default ?? (mod as Record<string, unknown>).config;

	if (!raw) {
		throw new Error(`Config file must have a default export or named "config" export: ${resolved}`);
	}

	// Return as FlowPanelConfig — the caller (defineFlowPanel) will validate
	return raw as FlowPanelConfig;
}
