import { type FlowPanelConfig, flowPanelConfigSchema } from "./config/schema.js";
import { validateConfig } from "./config/validate.js";
import { createQueryBuilder, type QueryBuilder } from "./queryBuilder.js";
import { createReaper } from "./reaper.js";
import type { SqlExecutor, SqlExecutorFactory } from "./types/db.js";
import { createWithRun } from "./withRun.js";

export interface FlowPanel<TConfig extends FlowPanelConfig = FlowPanelConfig> {
	config: TConfig;
	withRun<T>(
		stage: TConfig["pipeline"]["stages"][number],
		callback: (run: import("./withRun.js").RunHandle) => Promise<T>,
	): Promise<T>;
	startReaper(options?: { interval?: string }): () => void;
	getDb(): Promise<SqlExecutor>;
	queryBuilder: QueryBuilder;
}

async function resolveDb(factory: SqlExecutorFactory): Promise<SqlExecutor> {
	if (typeof factory === "function") return factory();
	return factory;
}

/**
 * Define a FlowPanel pipeline dashboard.
 *
 * @example
 * ```ts
 * const flowpanel = defineFlowPanel({
 *   appName: "My App",
 *   adapter: prismaAdapter({ prisma }),
 *   pipeline: { stages: ["ingest", "process", "notify"] },
 *   security: { auth: { getSession } },
 * });
 * ```
 */
export function defineFlowPanel<TConfig extends FlowPanelConfig>(
	rawConfig: TConfig,
): FlowPanel<TConfig> {
	// Validate with Zod
	const parsed = flowPanelConfigSchema.safeParse(rawConfig);
	if (!parsed.success) {
		const messages = parsed.error.issues
			.map((i) => `  ${i.path.join(".")}: ${i.message}`)
			.join("\n");
		throw new Error(`FlowPanel config validation failed:\n${messages}`);
	}

	const config = parsed.data as TConfig;

	// Semantic validation
	validateConfig(config as any);

	const cwd = process.cwd();
	const redactionKeys = config.security?.redaction?.keys ?? [];

	// Lazy-resolved DB executor (singleton per defineFlowPanel call)
	let dbPromise: Promise<SqlExecutor> | null = null;
	function getDb(): Promise<SqlExecutor> {
		if (!dbPromise) {
			dbPromise = resolveDb(config.adapter);
		}
		return dbPromise;
	}

	const queryBuilder = createQueryBuilder({
		stages: config.pipeline.stages,
		stageFields: config.pipeline.stageFields ?? {},
		fields: config.pipeline.fields ?? {},
	});

	const withRunImpl = async <T>(
		stage: string,
		callback: (run: import("./withRun.js").RunHandle) => Promise<T>,
	): Promise<T> => {
		const db = await getDb();
		const withRun = createWithRun({
			db,
			stageFields: config.pipeline.stageFields ?? {},
			stages: config.pipeline.stages,
			cwd,
			redactionKeys,
		});
		return withRun(stage, callback);
	};

	function startReaper(options?: { interval?: string }): () => void {
		const intervalStr = options?.interval ?? "60s";
		const match = intervalStr.match(/^(\d+)([smh])$/);
		const intervalMs = match
			? parseInt(match[1]!) * (match[2] === "s" ? 1000 : match[2] === "m" ? 60000 : 3600000)
			: 60000;

		const reaperThresholds: Record<string, string> = {};
		const configThresholds = config.pipeline.reaperThresholds ?? {};
		for (const stage of config.pipeline.stages) {
			reaperThresholds[stage] = configThresholds[stage] ?? "10m";
		}

		// Override sweep to lazily get db
		const stop = setInterval(async () => {
			const db = await getDb();
			const r = createReaper({ db, stages: config.pipeline.stages, reaperThresholds });
			r.sweep().catch((err) => console.error("[flowpanel] reaper error:", err));
		}, intervalMs);

		if ((stop as any).unref) (stop as any).unref();
		return () => clearInterval(stop);
	}

	return {
		config,
		withRun: withRunImpl as any,
		startReaper,
		getDb,
		queryBuilder,
	};
}

// Re-export z for convenience: import { defineFlowPanel, z } from "@flowpanel/core"
export { z } from "zod";
