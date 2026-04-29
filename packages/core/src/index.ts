export { z } from "zod";
export type { CanonicalAdapter, FlowPanelAdapter } from "./config/adapter";
export { brandAdapter } from "./config/adapter";
export type { AuditActor, AuditEvent } from "./config/auditEvent";
export type { FlowPanelConfig, FlowPanelConfigInput } from "./config/schema";
export { sqlIdentifier } from "./config/schema";
export {
  createFlowPanelHandler,
  type FlowPanelHandler,
  type FlowPanelHandlerContext,
  type FlowPanelHandlerOptions,
} from "./createFlowPanelHandler";
export type {
  FlowPanel,
  FlowPanelRouterConfig,
  FlowPanelSchema,
} from "./defineFlowPanel";
// `defineFlowPanel` is the root config factory.
// `resource` is a low-level descriptor factory kept for tests and for cases
// where no ORM metadata is available (string model name). In normal code,
// prefer `defineResource` — it does metadata inference and typed column refs.
export { defineFlowPanel, resource } from "./defineFlowPanel";
export {
  type ConfigErrorContext,
  FlowPanelAccessError,
  FlowPanelAdapterError,
  FlowPanelConfigError,
  FlowPanelError,
  FlowPanelValidationError,
} from "./errors";
export {
  didYouMean,
  fromZodError,
  renderCodeFrame,
  renderConfigError,
} from "./errors/index";
// Metric helpers
export {
  type BreakdownOptions,
  type BreakdownParams,
  breakdown,
  defaultBucketFor,
  type MetricBucket,
  type MetricCtx,
  type MetricHandle,
  type MetricOptions,
  type MetricRange,
  metric,
  parseRange,
  previousRange,
  type TimeseriesOptions,
  type TimeseriesParams,
  timeseries,
} from "./metric";
export { applyMigrations, getMigrationStatus } from "./migrationRunner";
// Pages module (custom admin pages) — only the public types; resolve/serialize
// helpers are internal pipeline steps used by the tRPC router.
export type {
  FlowPanelPage,
  PageAccessContext,
  PageAccessRule,
  ResolvedPage,
  SerializedPage,
} from "./pages/types";
export { createQueryBuilder } from "./queryBuilder";
// Queue module — types only; resolve/serialize helpers are internal.
export type {
  GetJobsArgs,
  JobState,
  QueueAdapter,
  QueueJob,
  QueueStatus,
  ResolvedQueue,
  SerializedQueue,
} from "./queue/types";
export { createReaper } from "./reaper";
// Resource module — typed builder + public types; the `createFilter`,
// `mergeFilters`, `createResourceDescriptor`, `resolveResource`,
// `serializeResource` helpers are pipeline internals and kept unexported.
export { defineResource } from "./resource/defineResource";
export type {
  DefineResourceOptions,
  TypedAction,
  TypedBulkAction,
  TypedBulkEditAction,
  TypedColumn,
  TypedComputedColumn,
  TypedFieldColumn,
  TypedFilter,
  TypedResourceDefinition,
  TypedRowAction,
} from "./resource/typedTypes";
export type {
  AccessConfig,
  AccessRule,
  ActionBuilder,
  ActionDownloadResult,
  BulkActionConfig,
  CollectionActionConfig,
  ColumnFormat,
  ConfirmConfig,
  DialogActionConfig,
  DialogField,
  DialogSchema,
  FieldMetadata,
  FilterMode,
  FilterOp,
  FindManyArgs,
  InferRow,
  LinkActionConfig,
  ModelMetadata,
  MutationActionConfig,
  NormalizedFilter,
  ResolvedAction,
  ResolvedBulkAction,
  ResolvedCollectionAction,
  ResolvedColumn,
  ResolvedDialogAction,
  ResolvedFilter,
  ResolvedLinkAction,
  ResolvedMutationAction,
  ResolvedResource,
  ResourceAdapter,
  ResourceDescriptor,
  ResourceOptions,
  Row,
  SerializedAccess,
  SerializedAction,
  SerializedBulkAction,
  SerializedCollectionAction,
  SerializedColumn,
  SerializedDialogAction,
  SerializedFilter,
  SerializedLinkAction,
  SerializedMutationAction,
  SerializedResource,
} from "./resource/types";
export { generateSchema } from "./schemaGenerator";
// Realtime stream handler — mounted at a separate route from tRPC.
export {
  createFlowPanelStreamHandler,
  type FlowPanelStreamHandler,
  type FlowPanelStreamHandlerOptions,
} from "./stream/handler";
// Context helper
export { createFlowPanelContext, type FlowPanelContextBase } from "./trpc/createContext";
// Module augmentation — declare your db / session shape once; every
// resource callback picks it up without casts or generic repetition.
export type { FlowPanelTypes, FpDb, FpSession } from "./types/augmentation";
export type { RunFields } from "./types/config";
export type { SqlExecutor, SqlExecutorFactory, SqlQuery } from "./types/db";

// Widget / Dashboard module — only the builder factory + public types.
// The resolve/evaluate/serialize helpers are pipeline internals used by
// the tRPC router and not part of the user-facing API.
export { createWidgetBuilder } from "./widget/builder";
export type {
  ChartBucket,
  ChartWidgetConfig,
  ChartWidgetData,
  CustomWidgetConfig,
  CustomWidgetData,
  DashboardConfig,
  DashboardData,
  DashboardSection,
  ListItem,
  ListWidgetConfig,
  ListWidgetData,
  MetricTrend,
  MetricWidgetConfig,
  MetricWidgetData,
  ResolvedChartWidget,
  ResolvedCustomWidget,
  ResolvedListWidget,
  ResolvedMetricWidget,
  ResolvedSection,
  ResolvedWidget,
  SerializedChartWidget,
  SerializedCustomWidget,
  SerializedListWidget,
  SerializedMetricWidget,
  SerializedWidget,
  WidgetBase,
  WidgetBuilder,
  WidgetData,
  WidgetLayout,
} from "./widget/types";
export type { RunHandle } from "./withRun";
