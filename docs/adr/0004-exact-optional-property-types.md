# ADR 0004 — `exactOptionalPropertyTypes` discipline in package source

**Status:** Accepted (since M1)

## Context

TypeScript's `strict` mode does not enable `exactOptionalPropertyTypes` by
default. Without it, a type like:

```ts
interface Props {
  width?: "sm" | "md" | "lg";
}
```

silently accepts `width: undefined` as a value of `Props`. That's usually
not what callers mean — they want `Props` to be either `{ width: "sm" }` or
`{}`, never `{ width: undefined }`. The distinction is real and shows up
at JSX prop boundaries: passing `<Component width={maybeUndefined} />`
does very different things from `<Component {...(maybeUndefined ? { width: maybeUndefined } : {})} />`.

For a library that produces React components and accepts user config,
this distinction matters: an explicit `undefined` in user config should
either be rejected at compile time (clean), or not be possible to express
(cleanest).

## Decision

All `packages/*/src/**` source compiles under
`exactOptionalPropertyTypes: true` via `tsconfig.base.json`.

User configs (`flowpanel.config.ts` in their app) do **not** have to enable
the same flag — FlowPanel exposes its public types in a way that works
under both modes. The strictness is a maintainer discipline, not a
consumer requirement.

The practical implication is the **conditional-spread pattern** at every
optional-prop forwarding site:

```tsx
// instead of: <X width={maybeWidth} />
<X {...(maybeWidth ? { width: maybeWidth } : {})} />
```

This pattern shows up dozens of times across `packages/react` and
`packages/next` — particularly where AdminShell forwards props down or
Next bridges config into AdminShell.

## Consequences

**Wins:**

- Catches a class of real bugs at compile time. Notable examples already
  caught during M2 → M4a: passing `undefined` from `URLSearchParams.get(...)`
  to a prop typed as `string`, forwarding a default-config field that can
  be missing without realizing.
- The conditional-spread pattern, once internalized, is no harder to write
  than the naïve form — and forces a decision about default behavior at
  every forwarding boundary.

**Costs / constraints:**

- Slightly more verbose JSX at prop-forwarding sites.
- Subtle mismatches between user config types (which don't necessarily
  enforce the flag) and FlowPanel internals (which do) require careful
  type definitions: `theme?: ThemeConfig` on `AdminConfig` accepts an
  explicit `undefined` from user code, but the bridge in `flowpanel-page.tsx`
  must use the conditional-spread when passing down.
- Newcomers to the codebase need a one-line briefing on the pattern.

## References

- `tsconfig.base.json` — the flag is enabled here.
- `packages/react/src/_shell/AdminShell.tsx` — multiple conditional-spread
  examples (brand name, themeComponents, labels).
- `packages/next/src/flowpanel-page.tsx` — the config-to-shell bridge.
- `docs/invariants.md` invariant **I-8**.
