---
"@flowpanel/next": minor
"@flowpanel/react": patch
---

Fix realtime + accessibility issues surfaced by the e2e suite.

- **Realtime publisher is now process-global.** The in-memory publisher was
  a module-level singleton, so Next.js could hand the SSE-stream route and the
  action route separate instances — a `publishResource` from an action never
  reached the subscribed stream, and cross-tab live updates silently failed.
  It's now stored on `globalThis`, shared across every route handler.
- **Resource list pages subscribe to realtime.** When a resource declares
  `realtime`, its list view now opens the `resource.<name>` SSE channel and
  refreshes on mutation — previously only dashboard widgets did.
- **Skip link is the first focusable element.** In the sidebar shell it was
  rendered inside `<main>`, after the nav, so keyboard users couldn't bypass
  the nav. It's now the first child of the shell.
- **Muted + accent text meet WCAG AA.** `--fp-text-3` (was 3.3:1) and accent
  text on the accent background (was 4.3:1) now clear the 4.5:1 threshold.
