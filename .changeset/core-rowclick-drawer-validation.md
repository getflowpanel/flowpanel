---
"@flowpanel/core": patch
---

`defineAdmin` now throws at config-load time when a resource sets `rowClick: "drawer"` without a `drawer:` config block. Previously the misconfiguration was a silent no-op on the table — clicking a row did nothing, the only signal was a "resource has no drawer config" error inside the drawer if you manually crafted the `?drawer=<resource>:<id>` URL.
