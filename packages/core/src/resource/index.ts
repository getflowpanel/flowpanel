/**
 * Resource module barrel — re-exports all public resource APIs.
 */

// Descriptor factory
export { createResourceDescriptor } from "./resolver";

// Resolver
export { resolveResource } from "./resolver";

// Serializer
export { serializeResource } from "./serializer";

// Filter utilities
export {
  createFilter,
  mergeFilters,
  filtersToSearchParams,
  searchParamsToFilters,
} from "./filters";

// Path utilities
export { createPathProxy, resolvePath, resolvePathStrings, getPathString } from "./path";

// Builder factories
export { createColumnBuilder, createFilterBuilder, createActionBuilder } from "./builders";

// Types
export type {
  // Primitives
  Row,
  // Metadata
  FieldMetadata,
  ModelMetadata,
  // Filter IR
  FilterOp,
  NormalizedFilter,
  // Adapter
  FindManyArgs,
  ResourceAdapter,
  // Column
  ColumnFormat,
  FieldColumnOpts,
  ResolvedColumn,
  // Filter
  FilterMode,
  FilterOpts,
  ResolvedFilter,
  // Action
  ConfirmConfig,
  MutationActionConfig,
  ResolvedAction,
  // Access
  AccessRule,
  AccessConfig,
  FieldAccessRule,
  // Builder options
  ComputedColumnOpts,
  CustomColumnOpts,
  CustomFilterOpts,
  // Builder interfaces
  ColumnBuilder,
  FilterBuilder,
  ActionBuilder,
  // Resource
  ResourceOptions,
  ResourceDescriptor,
  ResolvedResource,
  // Serialized (client-safe)
  SerializedColumn,
  SerializedFilter,
  SerializedAction,
  SerializedAccess,
  SerializedResource,
  // Path
  Path,
  PathFn,
  PathProxy,
} from "./types";
