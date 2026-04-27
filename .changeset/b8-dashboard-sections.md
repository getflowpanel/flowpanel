---
"@flowpanel/core": minor
---

**B8 — Dashboard sections.**

`DashboardConfig` accepts a new sections shape:

```ts
dashboards: {
  home: {
    sections: [
      {
        title: "Revenue",
        description: "MRR + churn",
        widgets: (w) => [w.metric(...), w.chart(...)],
      },
      { title: "Users", widgets: (w) => [...] },
    ],
  },
}
```

`resolveDashboard` flattens sections into one widget list (server eval stays
unchanged); the new `resolveSections` returns `{ title, description,
widgetIds[] }` so the UI can group cards visually without re-resolving.

Flat configs (array / builder fn) continue to work — `resolveSections`
returns `null` for them.

The roadmap's additional widget types (w.kv / w.activity / w.timeline /
w.pipeline) remain open; we ship the sections layout first because it's
the biggest organizational DX win for dashboards that currently flatten
8+ cards into a single grid.
