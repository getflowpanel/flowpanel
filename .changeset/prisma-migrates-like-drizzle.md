---
"@flowpanel/adapter-prisma": minor
---

Give Prisma real `flowpanel migrate` support, one protocol per provider.

The adapter previously shipped only the compatibility `runMigrationSql` /
`markMigrationApplied` pair, so the CLI ran it in `legacy-hooks` mode: the SQL
and its applied marker were not atomic, and two migrators were not serialized.
It now implements `applyMigration(id, sql)`, which locks, rechecks the id and
records the marker at the database boundary — a duplicate id becomes a no-op
only after that recheck.

`prismaAdapter` now requires `provider` (`"postgresql" | "mysql" | "sqlite"`),
the same value as the `datasource` block in `schema.prisma`. Nothing portable
identifies the active provider at runtime, and both the lock protocol and the
SQL splitting rules depend on it, so the adapter asks rather than guesses.

**PostgreSQL and SQLite** keep every statement and the marker in one
transaction, behind an advisory lock and a write lock respectively.

**MySQL** commits DDL implicitly, so no transaction can roll a half-applied
file back, and Prisma cannot pin a connection for a session-level lock. The
adapter claims a durable row in `_flowpanel_migration_claims` instead: it
serializes migrators, outlives a crashed one, and records the statement a
failed run stopped at. That id then refuses to run until the schema is repaired
and the row deleted, rather than replaying partial DDL.

Migration SQL is now split with the provider's own rules — dollar quoting is
recognized everywhere but accepted only on PostgreSQL, and MySQL `#` comments
and its `--` whitespace rule apply only there. Client directives (`DELIMITER`,
`SOURCE`, `.read`, `\i`), executable MySQL comments and procedural bodies are
still rejected before anything executes, so a rejected file is never recorded
as applied.

The adapter is now covered by real PostgreSQL, MySQL and SQLite integration
tests. They caught two defects that mocks could not: `pg_advisory_xact_lock`
returns `void`, which Prisma refuses to deserialize, and MySQL clients disagree
on whether a no-op upsert reports zero rows or one matched row — so claim
ownership is decided by the primary key, not by an affected-row count.
