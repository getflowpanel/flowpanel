---
"@flowpanel/next": patch
---

Harden the server action handlers (row / bulk / dashboard / inline-update) for
release. No public API shape changes — existing exports keep the same
signatures.

- **inline-update now validates the value.** After the editable-allowlist
  check, the field value is validated against the resource's `update` schema
  (`adapter.inferSchema(ref).update`, picking the single field). A failing
  value returns `422 { ok: false, error: "validation failed", issues }`, and
  the parsed (coerced) value — not the raw input — is what gets written and
  audited. Falls back to skipping validation when the adapter exposes no
  usable `update` schema.
- **row / bulk / dashboard actions validate `input` against the declared
  `form`.** When an action declares a `form` (`FieldDef[]`), the client
  `input` is checked before `action.run` — `required` fields must be present,
  and Zod-shaped `field.validate` schemas are `safeParse`d. A failure returns
  `422 { ok: false, error: "validation failed", issues }`. Actions without a
  `form` pass input through unchanged.
- **bulk actions cap the id count.** More than 1000 ids returns
  `422 { ok: false, error: "too many ids (max 1000)" }` before the action
  runs, closing a cheap DoS vector.
- **500 responses no longer leak raw error messages.** All four handlers now
  return `err.safeMessage` when present, otherwise a generic `"internal error"`
  — raw adapter / DB messages (which can carry schema, column, or row details)
  are never returned to the client.
