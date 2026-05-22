---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
---

`ColumnDef.render(row, ctx) => ReactNode` now executes server-side; the resulting ReactNode tree is passed to the client `<DataTable>` as prerendered cells. The previous shape silently crashed at runtime with "Functions cannot be passed directly to Client Components". Render functions must not call client hooks — for client interactivity, use a `"use client"` component that takes its rendered data as plain props.

Dashboard `table()` widgets pointing at a resource now honor the resource's `columns` array (including humanized labels) instead of dumping raw schema column names.
