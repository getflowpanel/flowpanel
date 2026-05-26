// `flowpanel` is the umbrella package. It re-exports the typed config DSL,
// runtime helpers, and types from @flowpanel/core. Adapters, the Next.js
// bridge, the React UI, and chart builders live behind subpaths:
//   - flowpanel/drizzle, flowpanel/prisma   — adapter helpers
//   - flowpanel/next                         — Flowpanel(config), handlers(), stream()
//   - flowpanel/charts                       — areaChart / barChart / lineChart / pieChart
//   - flowpanel/client                       — client-side hooks (useLiveChannel, etc.)
//   - flowpanel/auth                         — withClerk / withNextAuth / withLucia presets
// See `package.json#exports` for the full subpath surface.

// ── Builders ────────────────────────────────────────────────────────────────
export {
  custom,
  dashboard,
  defineAdmin,
  metric,
  page,
  queue,
  resource,
  statGroup,
  table,
} from "@flowpanel/core";

// ── Runtime helpers ─────────────────────────────────────────────────────────
export {
  assertResourceScope,
  checkRequireRole,
  createPublisher,
  createRateLimiter,
  emitAudit,
  getRequestContext,
  runWithRequestContext,
  tryGetRequestContext,
} from "@flowpanel/core";

// ── Errors ──────────────────────────────────────────────────────────────────
export {
  FlowpanelAccessError,
  FlowpanelAuthError,
  FlowpanelConflictError,
  FlowpanelError,
  FlowpanelNotFoundError,
  FlowpanelRateLimitError,
  FlowpanelValidationError,
} from "@flowpanel/core";

// ── Labels (i18n) ───────────────────────────────────────────────────────────
export { DEFAULT_LABELS, formatLabel, mergeLabels } from "@flowpanel/core";

// ── Types — config ──────────────────────────────────────────────────────────
export type {
  AdminConfig,
  AuditConfig,
  AuditEvent,
  AuthConfig,
  FlowpanelComponentSlots,
  RateLimitConfig,
  ResolvedAdminConfig,
  ShellConfig,
  ShellMode,
  ThemeConfig,
} from "@flowpanel/core";

// ── Types — DSL ────────────────────────────────────────────────────────────
export type {
  ActionResult,
  BulkAction,
  ColumnDef,
  DetailTab,
  FieldDef,
  FieldType,
  FilterDef,
  FilterType,
  ListResult,
  ResourceConfig,
  ResourceOptions,
  RowAction,
  SelectOption,
} from "@flowpanel/core";

// ── Types — dashboard + widgets ────────────────────────────────────────────
export type {
  AreaChartOptions,
  AreaChartWidget,
  BarChartOptions,
  BarChartWidget,
  ChartBucket,
  ChartOptionsBase,
  CustomOptions,
  CustomWidget,
  DashboardConfig,
  DateRangeConfig,
  DateRangePreset,
  LineChartOptions,
  LineChartWidget,
  MetricDelta,
  MetricOptions,
  MetricWidget,
  NumericFormat,
  PageConfig,
  PieChartOptions,
  PieChartWidget,
  ResolvedDateRange,
  SectionConfig,
  Span,
  StatGroupOptions,
  StatGroupWidget,
  StatItem,
  TableWidget,
  TableWidgetOptions,
  Tone,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";

// ── Types — drawer ─────────────────────────────────────────────────────────
export type {
  DrawerAction,
  DrawerConfig,
  DrawerFieldFormSpec,
  DrawerTab,
  DrawerTabFields,
  DrawerTabResource,
  DrawerTabWidgets,
  DrawerWidth,
} from "@flowpanel/core";

// ── Types — adapter + runtime contexts ────────────────────────────────────
export type {
  Adapter,
  ActionContext,
  ColumnMeta,
  ItemQueryContext,
  ListQueryContext,
  MutationContext,
  QueryContext,
  Publisher,
  PublisherOptions,
  RateLimiter,
  RateLimitOptions,
  RequestContext,
  RequireRole,
  ResourceIntrospection,
  ScopeCheckInput,
} from "@flowpanel/core";

// ── Types — registry + queue + realtime + labels + palette + session ──────
export type {
  CommandGroup,
  CommandItem,
  CommandPaletteConfig,
  FlowpanelTypes,
  InferDB,
  InferRow,
  LabelsConfig,
  QueueConfig,
  QueueOptions,
  RealtimeConfig,
  ResolvedLabels,
  Scope,
  ScopeContext,
  Session,
} from "@flowpanel/core";
