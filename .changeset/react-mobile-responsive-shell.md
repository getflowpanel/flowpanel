---
"@flowpanel/react": patch
---

`<AdminShell>` is now mobile-responsive. Below `md` (768px) the sidebar collapses; a top bar with a hamburger button opens it as a Radix Dialog drawer (focus-trap, ESC, scroll lock, return focus — all from Radix). At `md+` the inline aside layout is unchanged. `<AdminNav>` public API is unchanged.
