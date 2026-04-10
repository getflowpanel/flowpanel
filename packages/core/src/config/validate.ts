import type { FlowPanelConfig } from "./schema.js";

export class ConfigValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigValidationError";
	}
}

const RESERVED_NAMES = new Set([
	"id",
	"stage",
	"status",
	"startedAt",
	"finishedAt",
	"durationMs",
	"errorClass",
	"errorMessage",
	"errorStack",
	"heartbeatAt",
	"isDemo",
	"isHistorical",
	"partitionKey",
	"externalId",
	"retryOfRunId",
]);

export function validateConfig(config: FlowPanelConfig): void {
	const stages = new Set(config.pipeline.stages);

	// Check reserved names in fields
	for (const key of Object.keys(config.pipeline.fields ?? {})) {
		if (RESERVED_NAMES.has(key)) {
			throw new ConfigValidationError(
				`pipeline.fields.${key}: "${key}" is a reserved field name. Remove it — it is already tracked automatically.`,
			);
		}
	}

	// Check reserved names in stageFields
	for (const [stage, fields] of Object.entries(config.pipeline.stageFields ?? {})) {
		for (const key of Object.keys(fields as Record<string, unknown>)) {
			if (RESERVED_NAMES.has(key)) {
				throw new ConfigValidationError(
					`pipeline.stageFields.${stage}.${key}: "${key}" is a reserved field name.`,
				);
			}
		}
	}

	// Check stageFields keys match declared stages
	for (const stage of Object.keys(config.pipeline.stageFields ?? {})) {
		if (!stages.has(stage)) {
			throw new ConfigValidationError(
				`pipeline.stageFields.${stage}: stage "${stage}" is not in pipeline.stages [${[...stages].join(", ")}].`,
			);
		}
	}

	// Check aiCostStages reference valid stageFields
	for (const [stage, costConfig] of Object.entries(config.pipeline.aiCostStages ?? {})) {
		if (!stages.has(stage)) {
			throw new ConfigValidationError(
				`pipeline.aiCostStages.${stage}: stage "${stage}" is not in pipeline.stages.`,
			);
		}
		const stageFields =
			(config.pipeline.stageFields as Record<string, Record<string, unknown>>)?.[stage] ?? {};
		for (const fieldName of [
			costConfig.costField,
			costConfig.tokensIn,
			costConfig.tokensOut,
			costConfig.model,
		]) {
			if (!(fieldName in stageFields)) {
				const available = Object.keys(stageFields).join(", ");
				throw new ConfigValidationError(
					`pipeline.aiCostStages.${stage}: field "${fieldName}" not found in stageFields.${stage}. ` +
						`Available: ${available || "(none)"}`,
				);
			}
		}
	}

	// Check reaperThresholds keys match stages
	for (const stage of Object.keys(config.pipeline.reaperThresholds ?? {})) {
		if (!stages.has(stage)) {
			throw new ConfigValidationError(
				`pipeline.reaperThresholds.${stage}: stage "${stage}" is not in pipeline.stages.`,
			);
		}
	}
}
