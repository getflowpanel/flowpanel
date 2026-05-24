---
"@flowpanel/next": minor
---

Auto-audit before/after diff for row actions.

Row-action handlers now automatically capture a shallow `{ before, after }`
diff in the emitted `AuditEvent`. The handler already loads the row before
running the action; on success it re-fetches the row and diffs the two
snapshots, keeping only the changed keys. A deleted row degrades to
`{ before, after: null }`; a side-effect-only action that doesn't touch the
row emits no diff.

The extra read is gated on `isAuditActive(config.audit,
resource.options.audit)` — when no audit sink is configured, or the
resource opted out via `audit: false`, the re-fetch is skipped entirely, so
the hot path stays free of an audit-only query. Inline-edit already carried
a precise field-level diff and is unchanged.

New helpers exported from the action-helpers module:
- `computeShallowDiff(before, after)` — shallow, `Object.is`-based.
- `isAuditActive(auditConfig, resourceAudit)`.

Bulk actions intentionally remain diff-less (per-row re-fetch across a
selection is N extra queries; the joined-id audit row is the trail there).
+12 unit tests.
