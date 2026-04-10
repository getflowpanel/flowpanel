import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SqlExecutor } from "./types/db.js";

// pg_advisory_lock key for migration serialization
const MIGRATE_LOCK_KEY = BigInt(
	"0x" + crypto.createHash("md5").update("flowpanel:migrate").digest("hex").slice(0, 16),
);

export interface MigrationFile {
	id: string; // e.g. "0001_init"
	sql: string;
	checksum: string;
}

function sha256(content: string): string {
	return crypto.createHash("sha256").update(content).digest("hex");
}

export async function loadMigrationFiles(dirs: string[]): Promise<MigrationFile[]> {
	const files: MigrationFile[] = [];
	for (const dir of dirs) {
		let entries: string[];
		try {
			entries = await fs.readdir(dir);
		} catch {
			continue; // dir may not exist yet
		}
		for (const entry of entries.sort()) {
			if (!entry.endsWith(".sql")) continue;
			const id = entry.replace(/\.sql$/, "");
			const sql = await fs.readFile(path.join(dir, entry), "utf8");
			files.push({ id, sql, checksum: sha256(sql) });
		}
	}
	// Sort by id (lexicographic, so 0001_ < 0002_)
	return files.sort((a, b) => a.id.localeCompare(b.id));
}

export async function ensureMigrationsTable(db: SqlExecutor): Promise<void> {
	await db.execute(
		`CREATE TABLE IF NOT EXISTS flowpanel_migrations (
      id          TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    TEXT NOT NULL,
      duration_ms INTEGER NOT NULL
    )`,
		[],
	);
}

export async function getAppliedMigrations(db: SqlExecutor): Promise<Set<string>> {
	const rows = await db.execute<{ id: string }>(
		"SELECT id FROM flowpanel_migrations ORDER BY id",
		[],
	);
	return new Set(rows.map((r) => r.id));
}

export async function applyMigrations(
	db: SqlExecutor,
	migrationDirs: string[],
	onProgress?: (id: string) => void,
): Promise<{ applied: string[]; skipped: string[] }> {
	await ensureMigrationsTable(db);

	// Acquire advisory lock for serialization
	await db.advisoryLock(MIGRATE_LOCK_KEY);

	try {
		const applied: string[] = [];
		const skipped: string[] = [];
		const files = await loadMigrationFiles(migrationDirs);
		const alreadyApplied = await getAppliedMigrations(db);

		for (const file of files) {
			if (alreadyApplied.has(file.id)) {
				skipped.push(file.id);
				continue;
			}

			const start = Date.now();
			await db.transaction(async (tx) => {
				// Split on semicolons for multi-statement SQL files
				const statements = file.sql
					.split(/;\s*\n/)
					.map((s) => s.trim())
					.filter(Boolean);

				for (const stmt of statements) {
					await tx.execute(stmt, []);
				}

				await tx.execute(
					`INSERT INTO flowpanel_migrations (id, checksum, duration_ms) VALUES ($1, $2, $3)`,
					[file.id, file.checksum, Date.now() - start],
				);
			});

			onProgress?.(file.id);
			applied.push(file.id);
		}

		return { applied, skipped };
	} finally {
		await db.advisoryUnlock(MIGRATE_LOCK_KEY);
	}
}

export async function getMigrationStatus(
	db: SqlExecutor,
	migrationDirs: string[],
): Promise<{ applied: string[]; pending: string[] }> {
	await ensureMigrationsTable(db);
	const files = await loadMigrationFiles(migrationDirs);
	const appliedSet = await getAppliedMigrations(db);
	return {
		applied: files.filter((f) => appliedSet.has(f.id)).map((f) => f.id),
		pending: files.filter((f) => !appliedSet.has(f.id)).map((f) => f.id),
	};
}
