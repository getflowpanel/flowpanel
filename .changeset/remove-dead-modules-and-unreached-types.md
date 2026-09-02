---
"@flowpanel/react": minor
"@flowpanel/core": minor
"@flowpanel/adapter-drizzle": patch
"@flowpanel/adapter-prisma": patch
"@flowpanel/adapter-bullmq": patch
"@flowpanel/charts": patch
---

Delete modules and types no surface reached, before 0.2 freezes them.

`Sheet` and `Tooltip` are gone from `@flowpanel/react`. Both were complete
Radix primitive families that FlowPanel itself never rendered — the shipped
slide-over is `Drawer`, and nothing anywhere drew a tooltip. Removing the
tooltip family also drops `@radix-ui/react-tooltip` from the install. The
`Dialog`, `Popover`, `Select` and `DropdownMenu` families are untouched: they
are used, and trimming individual members would leave a documented primitive
set that cannot be composed.

`AdapterCapabilities` and `AdapterV2` are gone from `@flowpanel/core`, along
with the optional `Adapter.capabilities` field and the `capabilities:
{ version: 2 }` literal both shipped adapters wrote. Nothing ever read the
value; a version marker no runtime consults is not a contract. `bindAdapterScope`
and `BoundAdapterScope` — the parts of that module that carry real meaning —
stay, and now live in `types/bound-scope.ts` rather than a file named after a
type that no longer exists.

Internally: `@flowpanel/adapter-bullmq` no longer declares `@flowpanel/core` as
a dependency it never imported, an orphaned `Kbd` component is deleted, four
guard helpers superseded by `withGuards` are removed from `@flowpanel/next`, and
the chart tick formatter's six-case switch collapses to the two-way branch it
always was.
