import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldNameToColumn, generateSchema, zodTypeToSql } from "../schemaGenerator.js";

describe("fieldNameToColumn", () => {
	it("converts camelCase to snake_case", () => {
		expect(fieldNameToColumn("tokensIn")).toBe("tokens_in");
		expect(fieldNameToColumn("aiCostUsd")).toBe("ai_cost_usd");
		expect(fieldNameToColumn("userId")).toBe("user_id");
	});
	it("leaves already-snake_case unchanged", () => {
		expect(fieldNameToColumn("source")).toBe("source");
	});
});

describe("zodTypeToSql", () => {
	it("maps z.string() to TEXT", () => {
		expect(zodTypeToSql(z.string())).toBe("TEXT");
	});
	it("maps z.string().max(50) to VARCHAR(50)", () => {
		expect(zodTypeToSql(z.string().max(50))).toBe("VARCHAR(50)");
	});
	it("maps z.number().int() to INTEGER", () => {
		expect(zodTypeToSql(z.number().int())).toBe("INTEGER");
	});
	it("maps z.number() to NUMERIC(12,6)", () => {
		expect(zodTypeToSql(z.number())).toBe("NUMERIC(12,6)");
	});
	it("maps z.boolean() to BOOLEAN", () => {
		expect(zodTypeToSql(z.boolean())).toBe("BOOLEAN");
	});
	it("maps z.date() to TIMESTAMPTZ", () => {
		expect(zodTypeToSql(z.date())).toBe("TIMESTAMPTZ");
	});
	it("maps z.object() to JSONB", () => {
		expect(zodTypeToSql(z.object({ x: z.string() }))).toBe("JSONB");
	});
});

describe("generateSchema", () => {
	// biome-ignore lint/suspicious/noExplicitAny: test config cast
	const config: any = {
		pipeline: {
			stages: ["parse", "score"],
			fields: { userId: z.string().nullable() },
			stageFields: {
				parse: { source: z.string(), itemsFound: z.number().int() },
				score: { tokensIn: z.number().int(), aiCostUsd: z.number(), model: z.string() },
			},
			indexes: [],
		},
	};

	it("includes stage fields with stage prefix", () => {
		const sql = generateSchema(config);
		expect(sql).toContain("parse_source TEXT");
		expect(sql).toContain("parse_items_found INTEGER");
		expect(sql).toContain("score_tokens_in INTEGER");
		expect(sql).toContain("score_ai_cost_usd NUMERIC(12,6)");
		expect(sql).toContain("score_model TEXT");
	});

	it("includes reserved columns", () => {
		const sql = generateSchema(config);
		expect(sql).toContain("id BIGSERIAL PRIMARY KEY");
		expect(sql).toContain("stage TEXT NOT NULL");
		expect(sql).toContain("status TEXT NOT NULL");
		expect(sql).toContain("user_id TEXT");
		expect(sql).toContain("partition_key TEXT");
	});

	it("includes stage constraint from config", () => {
		const sql = generateSchema(config);
		expect(sql).toContain("CHECK (stage IN ('parse', 'score'))");
	});

	it("includes core indexes", () => {
		const sql = generateSchema(config);
		expect(sql).toContain("CREATE INDEX");
		expect(sql).toContain("started_at DESC");
	});

	it("includes all 5 FlowPanel tables", () => {
		const sql = generateSchema(config);
		expect(sql).toContain("flowpanel_pipeline_run");
		expect(sql).toContain("flowpanel_ai_usage_daily");
		expect(sql).toContain("flowpanel_meta");
		expect(sql).toContain("flowpanel_audit_log");
		expect(sql).toContain("flowpanel_migrations");
	});
});
