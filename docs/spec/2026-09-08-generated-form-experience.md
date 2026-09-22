# Generated form experience

Observed on the authenticated FreelanceRadar synthetic user's edit route:
the page renders `Edit Пользователь`, `Select…` and `Save` even though Russian
action labels are configured. The form offers no direct cancel/back link to its
record. No values were submitted during this inspection.

## Small shared presentation phase

- Generated edit/create headings and buttons use configured labels, including
  resource singular labels. Add optional form heading templates with `{label}`
  and English defaults matching today's wording. Provide Russian preset values.
- AutoForm's default submit label comes from actions.save; an explicit caller
  override still wins, including an empty string. Generated create forms use
  the create action label. Keep list-create drawer behavior consistent.
- Native and asynchronous select defaults share configurable form strings for
  placeholder, no options, searching and load failure. Display strings never
  become option identity. Preserve custom placeholders/empty states and real
  remote-query cancellation and failure behavior.
- An optional AutoForm cancel link gives generated full-page create/edit forms
  an explicit way back to the resource/list. It must not submit. Preserve the
  target record identity and configured mount, and label it with actions.cancel.
  Do not introduce a generic dirty-state/confirmation framework in this phase.
- Use existing form error/value-retention and accessibility behavior. Do not
  claim translation of arbitrary user schemas, domain enum values or custom
  server validation messages.

## Separate security follow-up

ResourceEditPage currently omits adapter select and gives the fetched row to
resolveFormFields before projecting defaultValues. Any correction must declare
callback dependencies and resolve policy before fetching, retaining dynamic
hidden/readOnly semantics and reference labels. It must never load or resolve a
denied reference value merely to hide it from defaultValues later. Keep this
review separate from the visible-label/cancel changes; a green labels test does
not establish safe form query projection.

The edit-read surface is the role-allowed declared update fields (falling back
to generated non-primary-key writable controls) plus `update.expose`. The new
typed `update.expose` declaration is only for hidden/readOnly callback
dependencies: it never creates controls, default values, or write permission.
Policy is decided once before the scoped `get`, the adapter receives the known
readable selection, and the returned value is projected through that selection
again before form resolution. A write-only field stays blank but can accept an
authorized replacement. A denied reference value performs no related lookup;
a readable value performs its usual single scoped primary-key lookup. The POST
write path continues to use its full scoped trusted current row for write
policy and dynamic readOnly decisions.

## Evidence

RED/GREEN real form controls show configured Russian defaults, explicit empty
overrides survive, two equally translated choices retain distinct values, failed
reference loading shows an error and retains the current choice. Cancel
navigation is observed and no fetch/submit occurs. Generated create/edit page
tests cover configured paths and existing authorization. Verify existing form
submission failure retention tests. Browser inspection on the existing host is
read-only; mutation tests use isolated fixtures only.
