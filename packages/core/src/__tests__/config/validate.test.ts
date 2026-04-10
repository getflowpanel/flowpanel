import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ConfigValidationError, validateConfig } from "../../config/validate.js";

const baseConfig: any = {
	appName: "test",
	timezone: "UTC",
	basePath: "/admin",
	adapter: {},
	pipeline: {
		stages: ["parse", "score"],
		fields: { userId: z.string().nullable() },
		stageFields: {
			parse: { source: z.string() },
			score: {
				tokensIn: z.number().int(),
				aiCostUsd: z.number(),
				tokensOut: z.number().int(),
				model: z.string(),
			},
		},
		aiCostStages: {
			score: {
				costField: "aiCostUsd",
				tokensIn: "tokensIn",
				tokensOut: "tokensOut",
				model: "model",
			},
		},
	},
	security: { auth: { getSession: async () => null } },
};

describe("validateConfig", () => {
	it("passes valid config", () => {
		expect(() => validateConfig(baseConfig)).not.toThrow();
	});

	it("throws on reserved field name in fields", () => {
		const bad = {
			...baseConfig,
			pipeline: { ...baseConfig.pipeline, fields: { id: z.string() } },
		};
		expect(() => validateConfig(bad)).toThrow(ConfigValidationError);
		expect(() => validateConfig(bad)).toThrow('"id" is a reserved field name');
	});

	it("throws on aiCostStages referencing unknown field", () => {
		const bad = {
			...baseConfig,
			pipeline: {
				...baseConfig.pipeline,
				aiCostStages: {
					score: {
						costField: "nonexistent",
						tokensIn: "tokensIn",
						tokensOut: "tokensOut",
						model: "model",
					},
				},
			},
		};
		expect(() => validateConfig(bad)).toThrow(ConfigValidationError);
		expect(() => validateConfig(bad)).toThrow('"nonexistent"');
	});

	it("throws on aiCostStages referencing non-existent stage", () => {
		const bad = {
			...baseConfig,
			pipeline: {
				...baseConfig.pipeline,
				aiCostStages: {
					draft: {
						costField: "aiCostUsd",
						tokensIn: "tokensIn",
						tokensOut: "tokensOut",
						model: "model",
					},
				},
			},
		};
		expect(() => validateConfig(bad)).toThrow('stage "draft" is not in pipeline.stages');
	});

	it("throws on stageFields key not in stages", () => {
		const bad = {
			...baseConfig,
			pipeline: {
				...baseConfig.pipeline,
				stageFields: {
					...baseConfig.pipeline.stageFields,
					ghost: { x: z.string() },
				},
			},
		};
		expect(() => validateConfig(bad)).toThrow('stage "ghost" is not in pipeline.stages');
	});
});
