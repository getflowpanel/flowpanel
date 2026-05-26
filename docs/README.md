# `docs/` — internal contracts

User-facing documentation lives in [`apps/site/content/docs/`](../apps/site/content/docs/)
and renders at <https://flowpanel.dev>. This folder keeps only what's
internal-contract material:

- [`invariants.md`](./invariants.md) — public-API invariants (I-1..I-12).
  Every PR touching a public surface checks these.
- [`adr/`](./adr/) — Architecture Decision Records. Numbered, immutable
  once landed.
- [`spec/flowpanel-v1.0.md`](./spec/flowpanel-v1.0.md) — frozen 1.0
  technical specification.

For users landing on the project for the first time, start at
<https://flowpanel.dev/docs/introduction/getting-started>.
