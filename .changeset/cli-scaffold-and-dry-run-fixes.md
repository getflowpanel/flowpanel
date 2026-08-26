---
"@flowpanel/cli": patch
---

Fix scaffolding and dry-run defects across the CLI.

`migrate --dry-run` no longer opens a database connection. It previously called
the adapter's `listAppliedMigrations()` before the dry-run branch, and the
drizzle adapter's implementation issues `CREATE TABLE IF NOT EXISTS
_flowpanel_migrations` — a dry run wrote to the database. It now returns after
reading the migration directory and states plainly that applied state is
unknown without a connection.

`init` pins `@flowpanel/kit` and `@flowpanel/cli` to the CLI's own minor instead
of installing them unpinned, so templates cut for one version can no longer land
next to a kit from another. A kit/CLI minor mismatch is now a hard stop in
`init`, `doctor` and `eject`, checked before any template is written, naming
both versions and the upgrade command.

When no auth module is detected, `init` scaffolds a clearly-marked development
`getSession` stub at the path its config imports, instead of writing an import
that resolves to nothing and letting the next printed step die on it.

Also: the missing-`DATABASE_URL` hint now walks the `cause` chain, so it fires
through drizzle's `Failed query:` wrapper; `doctor --fix --dry-run` prints its
plan in human mode; `doctor --fix` refuses to scaffold outside a FlowPanel
project; `doctor` runs its eject-marker check and surfaces the first `tsc`
diagnostics; `doctor` says Next.js is missing rather than offering an upgrade;
`migrate` uses the detected package manager instead of hardcoding `pnpm dlx`;
`new` rejects an unknown `--kind` instead of coercing it to drizzle, and drops
the "add `resource` to the import above" instruction it has just carried out.
