# ADR 0003 — Eject offers three targets, not four

**Status:** Accepted (M4a → frozen for 1.0)

## Context

Spec §8 defines a three-tier customization ladder:

1. **Props** — change behavior via config (most users, ~90% of needs).
2. **Custom widgets + `theme.components` overrides** — swap pieces of the
   chrome without owning the layout (~8%).
3. **Eject** — take ownership of a whole piece (~2%).

The eject design question: which whole pieces are ejectable? Three obvious
candidates: a **resource** (the list/detail/edit/new tetraptych), a
**dashboard** (a custom widget composition), and the **layout** (the admin
shell wrapping everything). A natural fourth candidate would be a single
**widget** — eject just the metric card, just the chart.

## Decision

Eject offers exactly three targets: **resource**, **dashboard**, **layout**.
No fourth. The CLI surface is:

```bash
flowpanel eject resource users
flowpanel eject dashboard /monitoring
flowpanel eject layout
```

M4a ships `resource` only; `dashboard` and `layout` are scaffolded to throw
"not yet implemented" and land in a follow-up release before 1.0.x.

## Why not eject individual widgets?

A custom widget already _is_ user-owned code:

```ts
custom(MyOwnComponent, async (ctx) => …)
```

If the user wants to take ownership of a widget, they wrap a `custom(...)`
around their own component and pass it to a dashboard. There's nothing
FlowPanel renders that they can't replace via `theme.components` (L2) or
custom widgets without ejecting.

Adding a fourth eject target would split the mental model: "is this widget
ejectable, or do I just drop a custom?" Three targets, three rules:

- Resource = the whole list/detail surface.
- Dashboard = the widget composition + page route.
- Layout = the admin shell (nav, header, providers).

If you're in any of those territories and props + L2 overrides aren't
enough, eject. Otherwise, custom widget.

## Consequences

**Wins:**

- Simpler mental model. Three eject verbs, zero ambiguity.
- The `theme.components` slot registry stays the canonical mechanism for
  fine-grained widget swaps (cheaper, reversible, no codebase churn).
- The eject CLI's surface is small: three subcommands, each with the same
  marker stamp + AST edit pattern.

**Costs / constraints:**

- Users who want to surgically own one widget without ejecting the entire
  resource have to either use `theme.components` or wrap with `custom(…)`.
- The "three targets, no fourth" rule is documented in `docs/invariants.md`
  as **I-6**. Adding a fourth target = ADR + major version bump.
- M4a ships only the resource target; full coverage of all three lands in
  a 1.0.x patch release. The dashboard/layout reject paths give clear "not
  yet" errors so users don't wait silently.

## References

- `packages/cli/src/commands/eject.ts` — the command + dispatch.
- `packages/cli/src/eject/{marker,copyTargets,editConfig}.ts` — the
  shared infrastructure all three targets reuse.
- `packages/cli/src/templates/ejected/resource/` — the 5-file scaffold for
  the resource target.
- `docs/spec/flowpanel-v1.0.md` §8 — the customization ladder.
