---
"@flowpanel/react": patch
"@flowpanel/next": patch
---

Default human-readable label transform for column headers and drawer field labels. `email` → `Email`, `telegramId` → `Telegram ID`, `createdAt` → `Created at`. Common initialisms (ID, URL, API, IP, UUID, HTTP, SQL, JSON, CSV, XML, HTML, CSS, DNS) stay uppercase. Explicit `header` / `label` in the config still wins. New `humanize` + `resolveFieldLabel` helpers exported from `@flowpanel/react`.

Tabs strip (`shell.mode: "tabs"`) now scrolls horizontally on narrow viewports via `overflow-x-auto` + a new `.fp-scrollbar-hide` utility; the active tab auto-`scrollIntoView({ inline: "center" })` on route change.
