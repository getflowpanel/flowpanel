---
"@flowpanel/adapter-drizzle": patch
---

The adapter lists, reads, filters, sorts and counts a Drizzle view declared with `.existing()`, reports it as `kind: "view"`, and never validates a write against it.
