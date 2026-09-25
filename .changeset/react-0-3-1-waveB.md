---
"@flowpanel/react": patch
---

`useAdminDrawer` keeps the drawer's own tab in `?drawerTab=` and still reads `?tab=`, so a drawer opened over a record page leaves the page's tab alone when it switches tabs or closes.

`StatStrip` draws numbers as one band divided by hairlines, two per line on a phone, and `MetricCard` and `StatCard` take `plain` to drop their frame inside it; the change, the previous value, the sparkline and the link stay.
`PageHeader` takes `badges`, several pills in order, each an optional link; `badge` still renders one.
