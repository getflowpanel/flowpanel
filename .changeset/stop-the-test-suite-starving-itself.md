---
"@flowpanel/cli": patch
---

Stop the workspace test suite starving itself.

`pnpm test:unit` failed roughly one run in three, in a different package each
time and with no error attached. Every package runs its own vitest, turbo starts
them together, and each one sizes its worker pool to the whole machine — so ten
suites each claimed ten workers on ten cores. The suites then starved one another
past vitest's default timeouts, which is what surfaced as the unexplained
failures.

A shared pool config gives each package a slice of the machine instead. The four
adapter-drizzle files that each start their own Docker container now run one at a
time, and the CLI suite — which shells out to `tsc`, Tailwind and `pnpm pack` —
gets a timeout that matches the work it does.
