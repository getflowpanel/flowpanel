---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/adapter-drizzle": patch
"@flowpanel/adapter-prisma": patch
"@flowpanel/react": patch
"@flowpanel/cli": patch
---

Rows open, forms explain themselves and a config that cannot work says so.

`rowClick` accepts `"detail"`, which navigates to the row's own page through the
router, and its default changes: a resource that configures `detail` and no
`drawer` now opens the detail page on a row click where it previously did nothing.
A resource that configures only a drawer still opens the drawer, a resource with
neither still has inert rows, and an explicit `rowClick` — including `false` —
still wins. Keyboard and pointer stay in agreement: Enter follows the same path as
a click, a row the projection could not identify never navigates, the table's
"Enter opens" hint is announced only when some row on the page can be opened, and
the mobile card list obeys the same rule. Destinations are built server-side from
each row's identity, so an id carrying `/` or `?` still addresses its own record.

Form validation reads like a sentence about the field. A value the write needs but
did not get now says `labels.form.required` ("{label} is required") under the
field's own label — or the humanized column name when the form declares no fields —
instead of reporting a type mismatch the reader did not cause. Only the schema's
own missing-value rejections are rewritten, so a message you wrote yourself
survives an empty submit. A value that cannot be read as its column's type says
`labels.form.invalidNumber`, `invalidBoolean` or `invalidDate`. Every message a
reader can see is a label with an English default and a Russian entry; messages
your schema or `validate` rule wrote still pass through unchanged.

A failed adapter read is now FlowPanel's own surface rather than a crashed route.
When `list` or `get` throws while a list page, a detail page or a related tab
renders, the page shows a card naming the resource and the operation
(`labels.errors.queryTitle`, `queryHint`) with the request id the cause was logged
under; development adds the message. Access, not-found and `redirect()` keep
travelling to the boundaries that own them. The widget error card takes its copy
from the same `labels.errors` group.

`defineAdmin` now carries `warnings: readonly string[]` on the resolved config. A
resource whose create form cannot satisfy a required column is named there, printed
once per process in development, and listed by `flowpanel doctor`. A column counts
as required when the adapter reports it as non-nullable, not generated, not
defaulted and not the primary key, and nothing a create write carries would fill
it: neither `create.fields`, nor `columns` when `create.fields` is absent, nor
`create.defaultValues`. `ColumnMeta` gains `hasDefault`, which both shipped
adapters now report from Drizzle's `column.hasDefault` and Prisma's
`field.hasDefault`, so a column the database fills itself is quiet. `doctor` reads
the warnings by evaluating `flowpanel.config.ts`; when that fails it says so in one
line rather than reporting nothing.

Config typos get a suggestion from one shared matcher: an exact match once casing
and word separators are ignored, else the closest known name within an edit
distance of two. It now covers `rowKey` as well as `columns`, `filters`,
`defaultSort.field`, form field names and cross-resource references.
