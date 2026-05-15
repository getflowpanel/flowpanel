<!-- Thanks for sending a PR! Please fill the template below. -->

## Summary

<!-- One sentence: what does this PR do? -->

## Motivation

<!-- Why is this change worth making? Link to the issue if any. -->
<!-- Closes #N -->

## Public API impact

- [ ] Touches `packages/*/src/index.ts` or a builder signature
- [ ] Pure internal change (no public surface)

<!-- If public, list the symbols added / changed / removed and the
     invariant from docs/invariants.md or ADR you're acting under. -->

## Tests

- [ ] Unit tests added / updated (`pnpm -r test:unit`)
- [ ] Integration / E2E exercised when applicable
- [ ] Type tests (tsd) updated if a public type changed

## Changeset

- [ ] `pnpm changeset` ran and the entry is committed

<!-- If this is a docs-only / internal-only change with no user-visible
     effect, you can skip the changeset and add the `skip-changeset`
     label after opening the PR. -->

## Checklist

- [ ] DCO sign-off (`git commit -s`)
- [ ] `pnpm -r typecheck` passes locally
- [ ] `pnpm -r test:unit` passes locally
- [ ] No new `any` in public types

## Screenshots / Recording (UI changes)

<!-- Drop screenshots / GIFs / Loom links if the change is visible. -->
