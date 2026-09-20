---
"@flowpanel/kit": patch
"@flowpanel/core": minor
"@flowpanel/next": patch
"@flowpanel/react": patch
---

`@flowpanel/kit` now ships `llms.txt`. It is the reference documentation as one
plain-text file: the install command, then every reference page in reading order
with its headings, its property tables and its code blocks. The property tables
are generated from the packages' own TypeScript declarations — property, type,
description, `@defaultValue` — and the CLI section carries every command with its
real flags, so the file answers what an option is called and what it accepts
without a network round trip. An agent working in a project that installed
FlowPanel reads `node_modules/@flowpanel/kit/llms.txt` instead of guessing at the
DSL from declaration names, and the site's own `/llms.txt` index points at the
package copy. `pnpm docs:llms` regenerates it and `pnpm check:docs` fails with
`llms-stale` when the checked-in file no longer matches the documentation it came
from. The file says plainly which code blocks are verified: blocks the docs mark
`twoslash` are type-checked in CI, `excerpt` blocks are illustrative and may omit
surrounding code, and the marker stays on every fence so a reader can tell which
is which.

`pnpm check:docs` also proves that every declared option is mentioned by runtime
code. Each member of an option-shaped core type — one whose name ends in `Config`,
`Context`, `Def`, `Item`, `Options`, `Row`, `Spec` or `Tab`, nested groups
included — must appear as `.member`, `["member"]` or a destructuring in at least
one non-test source file outside the type declarations and the locale tables, or
the check reports it at its declaration's own line. What that catches is the
option nothing references at all: added to a type and a doc page, and to nothing
else. What it cannot catch is an option that is read and then dropped —
`table().emptyState` was forwarded into a component that ignored it, and no
name-based check sees that; only a rendering test does. Members that are type-only
by construction live in `scripts/docs/option-allowlist.ts` with a one-line reason
each, and an entry that stops matching a real miss is itself a failure, so the
allowlist cannot quietly outlive its reason.

Three labels it found were declared, translated and never rendered. A table's
pager now shows the range it is displaying — `1–25 of 200`, from
`labels.pagination.of`, so a Russian admin reads `1–25 из 200`. A drawer opened on
a resource that also has a detail page now offers that page, with
`labels.drawer.viewDetails` as its link text. And the form banner that appears
when a submit fails with no field errors of its own now reads
`labels.formError` instead of a hardcoded English sentence; its default keeps the
wording it had ("Something went wrong — please try again.") and the Russian
locale finally applies. The dead `label` fields in the date-range preset tables
are gone: those pickers already read `labels.dateRange`, and nothing read the
hardcoded copy sitting next to them.

`AuditConfig.retention` is removed. It described an advisory retention window
that nothing ever applied: audit events reach your own `sink` and FlowPanel stores
none of them itself, so no adapter, migration or callback could act on the value.
A config that sets `audit.retention` should delete the line and keep the policy
where the rows actually live.
