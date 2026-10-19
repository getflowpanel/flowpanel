/** Keeps on-demand chunks, the toaster, forms and widget cards included, out of the first-render check. */
const firstRenderOnly = (config) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    {
      name: "on-demand-chunks-external",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) =>
          args.kind === "dynamic-import" ? { path: args.path, external: true } : undefined,
        );
      },
    },
  ],
});

const UI = { path: "dist/react.js", import: "{ AdminShell, DataTable, AutoForm, MetricCard }" };

export default [
  {
    name: "@flowpanel/kit/react UI on a list's first render (shell, table; forms and cards load on use)",
    ...UI,
    modifyEsbuildConfig: firstRenderOnly,
    // 0.4.0 launch, merged: forms, widget cards, menus, popovers, selects, the toaster and the shortcut sheet load on use; phone file-action icons, fixed-width tabs, fit-to-widest and the audit and import labels come with the shell; measured 55.51 KB.
    limit: "55.55 KB",
  },
  {
    name: "@flowpanel/kit/react on-demand chunks (importer dialogs and CSV parser, leave-guard dialog), alone with what they import",
    path: ["dist/react/data/ImportDialogs.mjs", "dist/react/feedback/ConfirmDialog.mjs"],
    import: {
      "dist/react/data/ImportDialogs.mjs": "{ ImportConfirm, ImportResult, readImportFile }",
      "dist/react/feedback/ConfirmDialog.mjs": "{ ConfirmDialog }",
    },
    // 0.4.0 launch, merged: the skipped-columns line and the audit, form-loading and show-all-columns labels ride along; measured 29.30 KB.
    limit: "29.35 KB",
  },
  {
    name: "@flowpanel/kit/react on-demand form (AutoForm with its fields and validation)",
    path: "dist/react/forms/AutoForm.mjs",
    import: "{ AutoForm }",
    modifyEsbuildConfig: firstRenderOnly,
    // 0.4.0 launch, merged: zod and Conform load here, not with the list; the inert fields, their loading status and the larger switch; measured 39.66 KB.
    limit: "39.7 KB",
  },
  {
    name: "@flowpanel/kit/react on-demand menus, popovers and selects",
    path: [
      "dist/react/ui/dropdown-menu-parts.mjs",
      "dist/react/ui/popover-parts.mjs",
      "dist/react/ui/select-parts.mjs",
    ],
    import: {
      "dist/react/ui/dropdown-menu-parts.mjs":
        "{ DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger }",
      "dist/react/ui/popover-parts.mjs": "{ Popover, PopoverContent, PopoverTrigger }",
      "dist/react/ui/select-parts.mjs": "{ Select, SelectContent, SelectItem, SelectTrigger }",
    },
    // 0.4.0: Radix and Floating UI load on a trigger's first press; measured 42.74 KB.
    limit: "42.8 KB",
  },
  {
    name: "@flowpanel/kit/react on-demand widget cards, together",
    path: [
      "dist/react/widgets/BarsCard.mjs",
      "dist/react/widgets/ChecklistCard.mjs",
      "dist/react/widgets/FunnelCard.mjs",
      "dist/react/widgets/HeatmapCard.mjs",
      "dist/react/widgets/KvCard.mjs",
      "dist/react/widgets/ListCard.mjs",
      "dist/react/widgets/MetricCard.mjs",
      "dist/react/widgets/StatCard.mjs",
      "dist/react/widgets/StatGroupCard.mjs",
      "dist/react/widgets/TimelineCard.mjs",
      "dist/react/widgets/TrackerCard.mjs",
    ],
    import: {
      "dist/react/widgets/BarsCard.mjs": "{ BarsCard }",
      "dist/react/widgets/ChecklistCard.mjs": "{ ChecklistCard }",
      "dist/react/widgets/FunnelCard.mjs": "{ FunnelCard }",
      "dist/react/widgets/HeatmapCard.mjs": "{ HeatmapCard }",
      "dist/react/widgets/KvCard.mjs": "{ KvCard }",
      "dist/react/widgets/ListCard.mjs": "{ ListCard }",
      "dist/react/widgets/MetricCard.mjs": "{ MetricCard }",
      "dist/react/widgets/StatCard.mjs": "{ StatCard }",
      "dist/react/widgets/StatGroupCard.mjs": "{ StatGroupCard }",
      "dist/react/widgets/TimelineCard.mjs": "{ TimelineCard }",
      "dist/react/widgets/TrackerCard.mjs": "{ TrackerCard }",
    },
    modifyEsbuildConfig: firstRenderOnly,
    // 0.4.0 launch, merged: the cards load with the first dashboard and carry the new labels; measured 21.31 KB.
    limit: "21.35 KB",
  },
  {
    name: "@flowpanel/kit/client (hooks)",
    path: "dist/client.js",
    import: "{ useAdminMutation }",
    limit: "1 KB",
  },
  {
    name: "@flowpanel/kit/charts as a page imports it (Recharts loads with the first chart drawn)",
    path: "dist/charts.js",
    import: "{ AreaChart, BarChart, LineChart, PieChart }",
    modifyEsbuildConfig: firstRenderOnly,
    // 0.4.0 launch, merged: Recharts stays behind the first draw; the empty and failed lines bring the labels context the admin already loads; measured 4.57 KB.
    limit: "4.6 KB",
  },
  {
    name: "@flowpanel/kit/charts own code with its on-demand chart body (Recharts not counted)",
    path: "dist/charts.js",
    import: "{ AreaChart, BarChart, LineChart, PieChart }",
    // 0.4.0 launch, merged: the lazy wrappers, their empty, failed and skeleton states and the new labels; measured 8.26 KB.
    limit: "8.3 KB",
    ignore: ["recharts"],
  },
];
