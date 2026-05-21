---
"@flowpanel/core": patch
"@flowpanel/next": patch
---

Add `DashboardConfig.hideActionsBar` opt-out.

Dashboards that render their own action UI in a `custom()` widget — for
example a dropdown menu inside a header widget — can now suppress the
default `DashboardActionsBar` while keeping the action endpoints generated
from `actions: [...]`.

```ts
dashboard({
  path: "/",
  label: "Парсинг",
  actions: queueActions,    // still drives endpoints
  hideActionsBar: true,     // hides default top-bar UI
  sections: [...],
});
```

When `hideActionsBar` is omitted or `false` the bar renders as before, so
this is fully backward compatible.
