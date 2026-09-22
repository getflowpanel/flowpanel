# Page projection safety

Confirmed blocker from the independent audit: list/detail pages re-project output
but omit adapter select, loading undeclared and denied columns into server memory.
The shared declaredRowFields union also adds drawer and all detail-tab fields to
lists. This blocks registration of an administrative session-history resource.

## Required behavior

- A list's row surface is configured columns, explicit resource.expose and rowKey.
  Drawer/detail-only declarations must not widen its SQL or serialized rows.
  A readable operational field such as `delete.softDelete` may be selected only
  to derive server-side table metadata (for example deleted row keys); it is not
  part of the list row surface, controls, or client payload.
- A detail page needs its base identity/presentation fields and the active tab's
  declared fields. Inactive tab renderers and related queries remain lazy.
- Add a narrow detail.expose field declaration if needed for header, hidden-tab
  predicates and custom renderer dependencies without widening the list. Existing
  resource.expose remains an explicit shared dependency declaration. Document that
  callbacks receive declared, readable fields; never infer dependencies by
  executing callbacks on a full database row.
- Resolve field policy before adapter work and supply explicit select, intersected
  with introspected columns. Never omit select because the result is empty: fail
  closed through a clear diagnostic or the existing adapter empty-select contract.
  Resolve operational metadata through that same per-request policy decision and
  suppress its indicator if policy denies the field.
- Hidden-tab predicates may need base-row data. A bounded two-stage read is allowed
  where necessary: safe base row determines visibility, then only active extra
  fields are loaded. Avoid extra reads where the active selection is known before
  loading. Keep scope binding on every read; re-project every returned row even if
  the adapter ignores select.
- Wildcard fields do not bypass declared fields or field policy. Row-key and
  required UI identity behavior must stay explicit.

## Verification

Add RED tests proving the old implementation (a) omits select, (b) widens list
payload with detail-only fields, and (c) loads inactive fields. Assert known-column
select for list/detail, denied token never selected, projected output never leaks
it even when an adapter returns it, active/hidden/unknown-tab behavior, per-request
field policy consistency and retained scope on every read. Retain controller,
drawer, export and adapter projection tests as defense in depth. Test public types
and documentation for any new dependency declaration. Update any legacy test that
encoded the broad union with its explicit replacement protection; do not merely
drop the assertion.

Commit this as a distinct framework change and obtain independent review before
building host packages or registering session/consent resources. Related-tab
pagination, CSS isolation and CLI lifecycle changes are separate contracts.
