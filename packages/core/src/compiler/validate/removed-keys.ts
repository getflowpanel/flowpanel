import { FlowpanelConfigError } from "../../types/config-error";

type Named = {
  key?: unknown;
  name?: unknown;
  path?: unknown;
  form?: unknown;
  actions?: unknown;
  options?: unknown;
  ref?: unknown;
};

function actionsOf(list: unknown): Named[] {
  return Array.isArray(list) ? (list.filter((a) => a && typeof a === "object") as Named[]) : [];
}

const PREDICATE_HINT =
  " A rule function receives { session, role, scope }, not the session: write " +
  "({ session }) => session !== null. A renamed (s) => s !== null lets every visitor in.";

/** Throws when `holder` still sets `requireRole`, naming the replacement and, for a function, its new argument. */
function rejectRole(where: string, holder: object, replacement = "access"): void {
  if (!("requireRole" in holder)) return;
  const predicate = typeof Reflect.get(holder, "requireRole") === "function";
  throw new FlowpanelConfigError(
    `${where} requireRole`,
    `requireRole was removed in 0.4. Gate it with ${replacement} instead.` +
      (predicate ? PREDICATE_HINT : ""),
  );
}

function rejectFieldRoles(where: string, fields: unknown): void {
  for (const field of actionsOf(fields)) {
    rejectRole(
      `${where} field "${String(field.name)}"`,
      field,
      `fieldAccess.${String(field.name)}`,
    );
  }
}

/** An action form field's `requireRole` was never enforced, so there is nothing to move it to. */
function rejectActionFieldRoles(where: string, fields: unknown): void {
  for (const field of actionsOf(fields)) {
    if ("requireRole" in field) {
      throw new FlowpanelConfigError(
        `${where} field "${String(field.name)}" requireRole`,
        "requireRole never gated an action's input and was removed in 0.4. Remove it, or gate " +
          "the whole action with access.",
      );
    }
  }
}

function sectionOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Fails a resource that still uses a key removed in 0.4: `requireRole` anywhere in it, or a detail or drawer `header`. */
export function assertNoRemovedResourceKeys(name: string, options: Record<string, unknown>): void {
  rejectRole(`resource "${name}"`, options);
  for (const part of ["detail", "drawer"] as const) {
    const section = options[part] as Record<string, unknown> | undefined;
    if (section && "header" in section) {
      throw new FlowpanelConfigError(
        `resource "${name}" ${part}.header`,
        `header was removed in 0.4. Name it ${part}.title.`,
      );
    }
  }
  const drawer = options.drawer as { actions?: unknown } | undefined;
  for (const [kind, list] of [
    ["action", options.actions],
    ["bulk action", options.bulkActions],
    ["drawer action", drawer?.actions],
  ] as const) {
    for (const action of actionsOf(list)) {
      const where = `resource "${name}" ${kind} "${String(action.key)}"`;
      rejectRole(where, action);
      rejectActionFieldRoles(where, action.form);
    }
  }
  rejectFieldRoles(`resource "${name}" create`, sectionOf(options.create).fields);
  rejectFieldRoles(`resource "${name}" update`, sectionOf(options.update).fields);
}

/** Fails a dashboard, page or queue that still gates itself with `requireRole`, including dashboard actions. */
function assertNoEntryRequireRole(config: Record<string, unknown>): void {
  for (const dashboard of actionsOf(config.dashboards)) {
    const where = `dashboard "${String(dashboard.path)}"`;
    rejectRole(where, dashboard);
    for (const action of actionsOf(dashboard.actions)) {
      const actionWhere = `${where} action "${String(action.key)}"`;
      rejectRole(actionWhere, action);
      rejectActionFieldRoles(actionWhere, action.form);
    }
  }
  for (const page of actionsOf(config.pages)) {
    rejectRole(`page "${String(page.path)}"`, page);
  }
  for (const queue of actionsOf(config.queues)) {
    const options = sectionOf(queue.options);
    const ref = sectionOf(queue.ref);
    rejectRole(`queue "${String(options.key ?? ref.name ?? options.label)}"`, options);
  }
}

/** Fails an auth adapter call that still passes `requireRole`, which would leave the admin open. */
export function assertNoAuthRequireRole(adapter: string, options: unknown): void {
  if (options && typeof options === "object") rejectRole(adapter, options);
}

/** Fails a config that still uses a top-level key removed in 0.4. */
export function assertNoRemovedConfigKeys(config: Record<string, unknown>): void {
  if ("basePath" in config) {
    throw new FlowpanelConfigError(
      "basePath",
      "basePath was removed in 0.4. Mount the admin with paths.admin.",
    );
  }
  rejectRole("auth", sectionOf(config.auth), "auth.access");
  assertNoEntryRequireRole(config);
}
