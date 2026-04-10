import { describe, expect, it } from "vitest";
import { createQueryBuilder } from "../queryBuilder.js";

const qb = createQueryBuilder({
	stages: ["parse", "score", "draft"] as const,
	stageFields: {
		parse: { source: true, itemsFound: true },
		score: { tokensIn: true, aiCostUsd: true, model: true },
		draft: { aiCostUsd: true, tokensIn: true },
	},
	fields: { userId: true },
});

describe("QueryBuilder", () => {
	it("q.count() generates COUNT(*) SQL", () => {
		const def = qb.count();
		expect(def.type).toBe("count");
		expect(def.sql).toContain("COUNT(*)");
	});

	it("q.successRate() references succeeded", () => {
		const def = qb.successRate();
		expect(def.sql).toContain("succeeded");
	});

	it("q.sum('aiCostUsd') aggregates across all stage columns", () => {
		const def = qb.sum("aiCostUsd");
		expect(def.sql).toContain("score_ai_cost_usd");
		expect(def.sql).toContain("draft_ai_cost_usd");
		// parse has no aiCostUsd
		expect(def.sql).not.toContain("parse_ai_cost_usd");
	});

	it("q.where({stage:'score'}).sum('aiCostUsd') scopes to single column", () => {
		const def = qb.where({ stage: "score" }).sum("aiCostUsd");
		expect(def.sql).toContain("score_ai_cost_usd");
		expect(def.sql).not.toContain("draft_ai_cost_usd");
	});

	it("q.avg('durationMs') uses reserved column duration_ms", () => {
		const def = qb.avg("durationMs");
		expect(def.sql).toContain("AVG(duration_ms)");
	});

	it("q.p95('durationMs') generates percentile query", () => {
		const def = qb.p95("durationMs");
		expect(def.sql).toContain("percentile_cont(0.95)");
		expect(def.sql).toContain("duration_ms");
	});

	it("q.where({stage}) stores filter", () => {
		const def = qb.where({ stage: "score" }).count();
		expect(def.where).toMatchObject({ stage: "score" });
	});

	it("q.hourly() generates time-bucket query", () => {
		const def = qb.hourly("count");
		expect(def.type).toBe("hourly");
		expect(def.sql).toContain("date_trunc");
	});

	it("q.byStage() generates GROUP BY stage", () => {
		const def = qb.byStage();
		expect(def.type).toBe("byStage");
		expect(def.sql).toContain("GROUP BY stage");
	});

	it("q.topErrors(5) generates error frequency query", () => {
		const def = qb.topErrors(5);
		expect(def.type).toBe("topErrors");
		expect(def.sql).toContain("error_class");
		expect(def.limit).toBe(5);
	});

	it("q.sum throws if field not found in any stage", () => {
		expect(() => qb.sum("nonExistentField")).toThrow();
	});
});

const mockConfig = {
	stages: ["ingest", "score"],
	stageFields: { ingest: {}, score: {} },
	fields: {},
};

describe("parameterized queries", () => {
	it("count() with stage filter uses $1 param, not string interpolation", () => {
		const qb = createQueryBuilder(mockConfig).where({ stage: "ingest" });
		const result = qb.count();
		expect(result.sql).toContain("$1");
		expect(result.sql).not.toContain("'ingest'");
		expect(result.params).toEqual(["ingest"]);
	});

	it("SQL injection attempt is safely parameterized", () => {
		const qb = createQueryBuilder(mockConfig).where({
			stage: "'; DROP TABLE flowpanel_pipeline_run; --",
		});
		const result = qb.count();
		expect(result.sql).not.toContain("DROP");
		expect(result.params?.[0]).toBe("'; DROP TABLE flowpanel_pipeline_run; --");
	});

	it("topErrors limit is parameterized", () => {
		const result = createQueryBuilder(mockConfig).topErrors(10);
		expect(result.sql).toMatch(/LIMIT \$\d/);
		expect(result.params).toContain(10);
	});

	it("chartBuckets includes time filter in params when timeRange set via where()", () => {
		const result = createQueryBuilder(mockConfig)
			.where({ timeRange: "24h" })
			.chartBuckets("24h", "postgres");
		expect(result.sql).toContain("started_at >=");
		expect(result.params!.length).toBeGreaterThan(0);
		expect(typeof result.params![0]).toBe("string");
	});

	it("count() without filters has empty params", () => {
		const result = createQueryBuilder(mockConfig).count();
		expect(result.params).toEqual([]);
		expect(result.sql).not.toContain("WHERE");
	});
});
