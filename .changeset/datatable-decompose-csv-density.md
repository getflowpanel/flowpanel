---
"@flowpanel/react": minor
---

DataTable: CSV export and density toggle wiring.

- New `exportable?: boolean` prop (default `false`) — renders an "Export CSV"
  toolbar button that downloads the visible columns of the rows currently on
  screen. Values reuse the cell formatter; fields are escaped per RFC 4180.
- New `showDensityToggle?: boolean` prop (default `false`) — renders the
  built-in `<DensityToggle>` wired to internal state seeded from `density`.
  `compact` tightens row padding and shrinks cell text.

Internal refactor: `DataTable.tsx` (729 LOC) split into focused modules
(`format-cell`, `data-table-types`, `useColumnLayout`, `useDataTableSelection`,
`useDataTableKeyboard`, `DataTableHeader`, `DataTableRow`, `DataTableSkeleton`,
`csv-export`) each under the 300-LOC cap. Public contract unchanged.
