---
"@flowpanel/core": patch
---

`defineAdmin(config)` no longer mutates the user's `ResourceConfig.options`. When `delete` is enabled and `bulkActions` is `undefined`, the resource is now CLONED with the default delete `bulkActions` injected; the original options object is left untouched. Fixes a subtle footgun where users sharing options between multiple `resource(...)` calls would see one's defaults leak into another.
