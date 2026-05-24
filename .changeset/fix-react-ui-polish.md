---
"@flowpanel/react": patch
---

UI/UX polish for the React package:

- **Inline-edit date cells now respect the viewer's timezone.** `InlineEditCell`
  rendered date values in UTC via `toISOString()`, diverging from read-only
  date cells (which use `LocalTime`). Display mode now renders through
  `LocalTime`, and the `datetime-local` input is seeded with local wall-clock
  components so the edit/save round-trip stays lossless and in the viewer's
  zone.
- **DevTools status dots use the design token.** The idle/connecting/offline
  dots in `DevToolsPanel` were hardcoded to `bg-[#9ca3af]`; they now use the
  shared `bg-fp-text-3` muted token (matching `StatusDot` / `LiveIndicator`).
- **`useOptimisticAction` rejection contract clarified.** The JSDoc now states
  that `run()` rejects on failure and callers MUST handle it (the example
  attaches a `.catch()`), preventing accidental unhandled rejections. Runtime
  behavior is unchanged.
