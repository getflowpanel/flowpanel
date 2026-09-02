export interface DefaultDocContract {
  typeName: string;
  member: string;
  value: string;
  consumerFile: string;
  consumerExpression: string;
}

export const DEFAULT_DOC_CONTRACTS = [
  {
    typeName: "ResourceOptions",
    member: "pageSize",
    value: "20",
    consumerFile: "packages/next/src/runtime/defaults.ts",
    consumerExpression: "export const DEFAULT_RESOURCE_PAGE_SIZE = 20;",
  },
  {
    typeName: "ResourceOptions",
    member: "density",
    value: '"comfortable"',
    consumerFile: "packages/react/src/_data/DataTable.tsx",
    consumerExpression: 'density = "comfortable"',
  },
  {
    typeName: "ResourceOptions",
    member: "rowKey",
    value: '"id"',
    consumerFile: "packages/next/src/runtime/defaults.ts",
    consumerExpression: 'export const DEFAULT_RESOURCE_ROW_KEY = "id";',
  },
  {
    typeName: "BulkAction",
    member: "max",
    value: "1000",
    consumerFile: "packages/next/src/actions/bulk-action.ts",
    consumerExpression: "const MAX_BULK = 1000;",
  },
  {
    typeName: "SectionConfig",
    member: "columns",
    value: "1",
    consumerFile: "packages/next/src/pages/dashboard.tsx",
    consumerExpression: "columns={sec.columns ?? 1}",
  },
  {
    typeName: "TableWidgetOptions",
    member: "limit",
    value: "10",
    consumerFile: "packages/next/src/runtime/render-widget.tsx",
    consumerExpression: "pageSize: widget.options.limit ?? 10",
  },
  {
    typeName: "CustomOptions",
    member: "frame",
    value: "true",
    consumerFile: "packages/next/src/runtime/render-widget.tsx",
    consumerExpression: "widget.options.frame === false ? inner : <ServerCard>{inner}</ServerCard>",
  },
  {
    typeName: "ChartOptionsBase",
    member: "height",
    value: "240",
    consumerFile: "packages/charts/src/runtime/defaults.ts",
    consumerExpression: "export const DEFAULT_CHART_HEIGHT = 240;",
  },
  {
    typeName: "PieChartOptions",
    member: "showLegend",
    value: "false",
    consumerFile: "packages/charts/src/runtime/PieChart.tsx",
    consumerExpression: "options.showLegend ? <Legend",
  },
  {
    typeName: "DrawerConfig",
    member: "width",
    value: '"lg"',
    consumerFile: "packages/next/src/drawer/drawer-route.ts",
    consumerExpression: 'drawer.width ?? "lg"',
  },
  {
    typeName: "CommandPaletteConfig",
    member: "placeholder",
    value: '"Search resources, actions…"',
    consumerFile: "packages/react/src/_shell/CommandPalette.tsx",
    consumerExpression: 'placeholder = "Search resources, actions…"',
  },
  {
    typeName: "UseRealtimeRefreshOptions",
    member: "debounceMs",
    value: "200",
    consumerFile: "packages/react/src/hooks/useRealtimeRefresh.tsx",
    consumerExpression: "opts.debounceMs ?? 200",
  },
  {
    typeName: "RealtimeProviderProps",
    member: "reopenDebounceMs",
    value: "50",
    consumerFile: "packages/react/src/realtime/RealtimeProvider.tsx",
    consumerExpression: "reopenDebounceMs = 50",
  },
  {
    typeName: "RealtimeProviderProps",
    member: "refreshDebounceMs",
    value: "400",
    consumerFile: "packages/react/src/realtime/RealtimeProvider.tsx",
    consumerExpression: "refreshDebounceMs = 400",
  },
] as const satisfies readonly DefaultDocContract[];
