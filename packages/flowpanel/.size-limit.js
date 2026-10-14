/** Keeps on-demand chunks out of the first-render check; the toaster always loads, so it counts. */
const firstRenderOnly = (config) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    {
      name: "on-demand-chunks-external",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) =>
          args.kind === "dynamic-import" && !args.path.includes("ToasterMount")
            ? { path: args.path, external: true }
            : undefined,
        );
      },
    },
  ],
});

const UI = { path: "dist/react.js", import: "{ AdminShell, DataTable, AutoForm, Form }" };

export default [
  {
    name: "@flowpanel/kit/react UI on first render (shell, table, forms, toaster)",
    ...UI,
    modifyEsbuildConfig: firstRenderOnly,
    // 0.4 polish: widths by need, refusals in the admin's language, wrapping phone cards and the nav's faded edge.
    limit: "87 KB",
  },
  {
    name: "@flowpanel/kit/react on-demand chunks (importer dialogs and CSV parser, leave-guard dialog), alone with what they import",
    path: ["dist/react/data/ImportDialogs.mjs", "dist/react/feedback/ConfirmDialog.mjs"],
    import: {
      "dist/react/data/ImportDialogs.mjs": "{ ImportConfirm, ImportResult, readImportFile }",
      "dist/react/feedback/ConfirmDialog.mjs": "{ ConfirmDialog }",
    },
    // The shared CSV writer moved to core with export's negative-number rule (+20 B).
    limit: "29.05 KB",
  },
  {
    name: "@flowpanel/kit/client (hooks)",
    path: "dist/client.js",
    import: "{ useAdminMutation }",
    limit: "25 KB",
  },
  {
    name: "@flowpanel/kit/charts (own code; Recharts not counted)",
    path: "dist/charts.js",
    import: "{ AreaChart, BarChart, LineChart, PieChart }",
    limit: "8 KB",
    ignore: ["recharts"],
  },
];
