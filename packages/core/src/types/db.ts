// SqlExecutor interface — all adapters implement this
export interface SqlExecutor {
	readonly dialect: "postgres" | "sqlite";
	execute<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]>;
	transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
	advisoryLock(key: bigint): Promise<void>;
	advisoryUnlock(key: bigint): Promise<void>;
	advisoryTryLock(key: bigint): Promise<boolean>;
	sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery;
}

export interface SqlQuery {
	text: string;
	values: unknown[];
}

// Factory: can be a direct instance or a lazy async loader
export type SqlExecutorFactory = SqlExecutor | (() => Promise<SqlExecutor>);

// DB row shapes for FlowPanel tables
export interface PipelineRunRow {
	id: bigint;
	stage: string;
	status: "running" | "succeeded" | "failed";
	external_id: string | null;
	retry_of_run_id: bigint | null;
	partition_key: string | null;
	started_at: Date;
	finished_at: Date | null;
	duration_ms: number | null;
	error_class: string | null;
	error_message: string | null;
	error_stack: string | null;
	is_demo: boolean;
	is_historical: boolean;
	heartbeat_at: Date | null;
	user_id: string | null;
	[key: string]: unknown; // stage-specific fields
}

export interface AiUsageDailyRow {
	day: Date;
	partition_key: string;
	stage: string;
	model: string;
	tokens_in: bigint;
	tokens_out: bigint;
	cost_usd: string; // NUMERIC returns string from pg
	run_count: number;
}

export interface MetaRow {
	key: string;
	value: unknown;
}

export interface AuditLogRow {
	id: bigint;
	at: Date;
	user_id: string;
	user_email: string | null;
	user_role: string;
	ip_address: string | null;
	user_agent: string | null;
	action: string;
	target_kind: string | null;
	target_ids: string[] | null;
	result: "success" | "denied" | "error";
	details: Record<string, unknown> | null;
	request_id: string | null;
}

export interface MigrationRow {
	id: string;
	applied_at: Date;
	checksum: string;
	duration_ms: number;
}
