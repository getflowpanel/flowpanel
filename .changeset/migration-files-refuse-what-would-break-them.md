---
"@flowpanel/adapter-drizzle": patch
"@flowpanel/core": patch
---

Reject migration SQL that would silently break the adapter's own guarantees.

Drizzle's `applyMigration` wraps a file's statements and the applied-marker in
one transaction, yet a `COMMIT` inside the file sailed through and split that
boundary without a word. Both adapters now share one policy, exported from the
core-internal SQL lexer: client directives (`DELIMITER`, `SOURCE`, psql and
sqlite dot commands, `GO`) and transaction-control statements are refused
loudly before any SQL runs. Previously the two adapters had drifted — Prisma
refused what Drizzle accepted.
