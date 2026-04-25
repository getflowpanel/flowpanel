---
"@flowpanel/core": minor
---

**B4 — Error UX overhaul.**

`FlowPanelConfigError` now renders with code frames, "Did you mean?" typo
suggestions, hints, and docs links. Zod validation failures inside
`defineFlowPanel` pass through `fromZodError` to surface the same shape
instead of a raw ZodError dump.

New exports: `didYouMean`, `fromZodError`, `renderCodeFrame`,
`renderConfigError`, and `ConfigErrorContext` (public type).
