---
"@flowpanel/react": patch
---

The build lists its entries in a fixed order, so the same source always produces the same chunks and the same bundle size.
Unused `ui` wrappers (dropdown, dialog, select, tabs parts) no longer land in an app's bundle: their `displayName` is set inside a call a bundler can drop.
