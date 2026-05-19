---
"@flowpanel/core": patch
---

Tighten `Adapter` type generics from `any` to `unknown` on `list`, `get`, `create`, `update`, `delete`, and `restore`. Adapter implementers must now narrow inside their handlers; consumers calling adapter methods receive `unknown` and should cast to the expected row type.
