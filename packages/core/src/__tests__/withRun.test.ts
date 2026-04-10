import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "../types/db.js";
import { createWithRun } from "../withRun.js";

// Mock SqlExecutor
function makeMockDb() {
	const rows: any[] = [];
	const calls: { sql: string; params: unknown[] }[] = [];

	const executor: SqlExecutor = {
		async execute(sql, params) {
			calls.push({ sql, params });
			if (sql.includes("INSERT") && sql.includes("pipeline_run")) {
				rows.push({ id: BigInt(1) });
				return [{ id: BigInt(1) }] as any;
			}
			if (sql.includes("UPDATE") && sql.includes("RETURNING")) {
				return [{ id: BigInt(1) }] as any;
			}
			return [];
		},
		async transaction(fn) {
			return fn(executor);
		},
		async advisoryLock() {},
		async advisoryUnlock() {},
		async advisoryTryLock() {
			return true;
		},
		sql(strings, ...values) {
			return { text: strings.join("?"), values };
		},
	};

	return { executor, calls, rows };
}

const stageFields = {
	score: { tokensIn: {}, aiCostUsd: {}, model: {} },
};

describe("withRun", () => {
	it("INSERTs a running row on start", async () => {
		const { executor, calls } = makeMockDb();
		const withRun = createWithRun({
			db: executor,
			stageFields,
			stages: ["score"],
			cwd: "/app",
			redactionKeys: [],
		});

		await withRun("score", async () => {});

		const insertCall = calls.find(
			(c) => c.sql.includes("INSERT") && c.sql.includes("pipeline_run"),
		);
		expect(insertCall).toBeDefined();
		expect(insertCall!.params).toContain("score");
		expect(insertCall!.params).toContain("running");
	});

	it("UPDATEs to succeeded on completion", async () => {
		const { executor, calls } = makeMockDb();
		const withRun = createWithRun({
			db: executor,
			stageFields,
			stages: ["score"],
			cwd: "/app",
			redactionKeys: [],
		});

		await withRun("score", async () => {});

		const updateCall = calls.find((c) => c.sql.includes("UPDATE") && c.sql.includes("succeeded"));
		expect(updateCall).toBeDefined();
	});

	it("accumulates run.set() fields and writes on finish", async () => {
		const { executor, calls } = makeMockDb();
		const withRun = createWithRun({
			db: executor,
			stageFields,
			stages: ["score"],
			cwd: "/app",
			redactionKeys: [],
		});

		await withRun("score", async (run) => {
			run.set({ tokensIn: 1200 });
			run.set({ aiCostUsd: 0.0021 });
		});

		const updateCall = calls.find(
			(c) => c.sql.includes("UPDATE") && c.sql.includes("score_tokens_in"),
		);
		expect(updateCall).toBeDefined();
		expect(updateCall!.params).toContain(1200);
	});

	it("catches error, records it as failed, re-throws", async () => {
		const { executor, calls } = makeMockDb();
		const withRun = createWithRun({
			db: executor,
			stageFields,
			stages: ["score"],
			cwd: "/app",
			redactionKeys: [],
		});

		const boom = new Error("Something went wrong");
		await expect(
			withRun("score", async () => {
				throw boom;
			}),
		).rejects.toThrow("Something went wrong");

		const failCall = calls.find((c) => c.sql.includes("UPDATE") && c.sql.includes("failed"));
		expect(failCall).toBeDefined();
		expect(failCall!.params).toContain("Error");
	});

	it("redacts apiKey in run.set()", async () => {
		const { executor, calls } = makeMockDb();
		const withRun = createWithRun({
			db: executor,
			stageFields: { score: { apiKey: {} } },
			stages: ["score"],
			cwd: "/app",
			redactionKeys: [],
		});

		await withRun("score", async (run: any) => {
			run.set({ apiKey: "sk-super-secret-key-1234567890" });
		});

		const updateCall = calls.find((c) => c.sql.includes("UPDATE"));
		// The value stored should be [REDACTED], not the actual key
		const paramStr = JSON.stringify(updateCall?.params ?? []);
		expect(paramStr).not.toContain("sk-super-secret-key");
		expect(paramStr).toContain("[REDACTED]");
	});

	it("warns on nested withRun but still executes", async () => {
		const { executor } = makeMockDb();
		const withRun = createWithRun({
			db: executor,
			stageFields,
			stages: ["score"],
			cwd: "/app",
			redactionKeys: [],
		});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		let innerRan = false;
		await withRun("score", async () => {
			await withRun("score", async () => {
				innerRan = true;
			});
		});

		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("nested withRun"));
		expect(innerRan).toBe(true);
		warnSpy.mockRestore();
	});

	it("run.heartbeat() updates heartbeat_at", async () => {
		const { executor, calls } = makeMockDb();
		const withRun = createWithRun({
			db: executor,
			stageFields,
			stages: ["score"],
			cwd: "/app",
			redactionKeys: [],
		});

		await withRun("score", async (run) => {
			await run.heartbeat();
		});

		const heartbeatCall = calls.find((c) => c.sql.includes("heartbeat_at"));
		expect(heartbeatCall).toBeDefined();
	});

	it("provides actionable error message when DB INSERT fails", async () => {
		const brokenDb: SqlExecutor = {
			...makeMockDb().executor,
			async execute(sql: string) {
				if (sql.includes("INSERT")) {
					throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
				}
				return [];
			},
		};
		const withRun = createWithRun({
			db: brokenDb,
			stageFields: {},
			stages: ["ingest"],
			cwd: "/app",
			redactionKeys: [],
		});
		await expect(withRun("ingest", async () => {})).rejects.toThrow(/Check database connectivity/);
	});
});
