/**
 * Resource Serializer — converts a ResolvedResource into a client-safe
 * SerializedResource by stripping all functions and evaluating access rules.
 */

import type {
  AccessConfig,
  AccessRule,
  ConfirmConfig,
  FieldColumnOpts,
  ResolvedResource,
  Row,
  SerializedAccess,
  SerializedAction,
  SerializedColumn,
  SerializedFilter,
  SerializedResource,
} from "./types";

// ---------------------------------------------------------------------------
// Access rule evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a single access rule against the current session roles.
 * - false → false
 * - string[] → true if any role matches
 * - undefined → true (allowed by default)
 * - function → true (evaluated per-row server-side, optimistically allowed)
 */
function evaluateAccessRule(rule: AccessRule | undefined, sessionRoles: string[]): boolean {
  if (rule === false) return false;
  if (Array.isArray(rule)) {
    return rule.some((r) => sessionRoles.includes(r));
  }
  if (typeof rule === "function") {
    // Per-row rules are evaluated server-side; default to allowed at route level
    return true;
  }
  // undefined → allowed
  return true;
}

// ---------------------------------------------------------------------------
// Column serialization
// ---------------------------------------------------------------------------

function serializeColumn(col: ResolvedResource["columns"][number]): SerializedColumn {
  const { href, ...restOpts } = col.opts as FieldColumnOpts & { href?: (row: Row) => string };

  const serialized: SerializedColumn = {
    id: col.id,
    path: col.path,
    label: col.label,
    type: col.type,
    format: col.format,
    opts: restOpts,
  };

  if (typeof href === "function") {
    serialized.hasHref = true;
  }

  return serialized;
}

// ---------------------------------------------------------------------------
// Filter serialization
// ---------------------------------------------------------------------------

function serializeFilter(filter: ResolvedResource["filters"][number]): SerializedFilter {
  return {
    id: filter.id,
    path: filter.path,
    label: filter.label,
    mode: filter.mode,
    opts: filter.opts,
  };
}

// ---------------------------------------------------------------------------
// Action serialization
// ---------------------------------------------------------------------------

function serializeConfirm(confirm: ConfirmConfig | undefined): ConfirmConfig | undefined {
  if (!confirm) return undefined;

  const { description, ...rest } = confirm;

  // Strip function description
  if (typeof description === "function") {
    return rest;
  }

  return confirm;
}

function serializeAction(
  action: ResolvedResource["actions"][number],
  accessRule: AccessRule | undefined,
  sessionRoles: string[],
): SerializedAction {
  return {
    id: action.id,
    type: action.type,
    label: action.label,
    icon: action.icon,
    variant: action.variant,
    confirm: serializeConfirm(action.confirm),
    allowed: evaluateAccessRule(accessRule, sessionRoles),
    onSuccess: action.onSuccess,
  };
}

// ---------------------------------------------------------------------------
// Access serialization
// ---------------------------------------------------------------------------

function serializeAccess(
  access: AccessConfig,
  actions: ResolvedResource["actions"],
  sessionRoles: string[],
  readOnly: boolean,
): SerializedAccess {
  const list = evaluateAccessRule(access.list, sessionRoles);
  const read = evaluateAccessRule(access.read, sessionRoles);
  let create = evaluateAccessRule(access.create, sessionRoles);
  let update = evaluateAccessRule(access.update, sessionRoles);
  let del = evaluateAccessRule(access.delete, sessionRoles);

  if (readOnly) {
    create = false;
    update = false;
    del = false;
  }

  const result: SerializedAccess = {
    list,
    read,
    create,
    update,
    delete: del,
  };

  // Evaluate per-action access rules
  for (const action of actions) {
    result[action.id] = evaluateAccessRule(access[action.id], sessionRoles);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------------------

/**
 * Serializes a ResolvedResource into a client-safe SerializedResource.
 * Strips all functions, evaluates access rules against sessionRoles.
 */
export function serializeResource(
  resource: ResolvedResource,
  sessionRoles: string[],
): SerializedResource {
  const readOnly = resource.readOnly === true;

  const columns = resource.columns.map(serializeColumn);
  const filters = resource.filters.map(serializeFilter);
  const actions = resource.actions.map((action) =>
    serializeAction(action, resource.access[action.id], sessionRoles),
  );
  const access = serializeAccess(resource.access, resource.actions, sessionRoles, readOnly);

  // Serialize fieldAccess — evaluate read/write rules to booleans
  const fieldAccess = resource.fieldAccess.map((fa) => ({
    path: fa.path,
    read: evaluateAccessRule(fa.read, sessionRoles),
    write: evaluateAccessRule(fa.write, sessionRoles),
  }));

  return {
    id: resource.id,
    modelName: resource.modelName,
    primaryKey: resource.primaryKey,
    label: resource.label,
    labelPlural: resource.labelPlural,
    icon: resource.icon,
    path: resource.path,
    defaultSort: resource.defaultSort,
    defaultPageSize: resource.defaultPageSize,
    searchFields: resource.searchFields,
    columns,
    filters,
    actions,
    access,
    fieldAccess,
  };
}
