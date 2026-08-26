import type {
  FlowpanelResult,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  authorizeOperation,
  errorResult,
  FlowpanelNotFoundError,
  FlowpanelUnknownFieldError,
  filterReadableProjection,
  reportUnexpectedError,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { makeActions } from "../actions/resource-actions";
import { actorIdFromSession } from "../runtime/action-helpers";
import { DEFAULT_RESOURCE_PAGE_SIZE, DEFAULT_RESOURCE_ROW_KEY } from "../runtime/defaults";
import { projectAuthorizedRow } from "../runtime/project-row";
import { requireAuthorized } from "../runtime/require-authorized";
import { scopeBinding } from "../runtime/scope-binding";
import { createActionController } from "./action-controller";

const MAX_PAGE_SIZE = 100;
const MAX_COLUMNS = 256;

export interface ResourceListOptions<Row> {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Record<string, unknown>;
  sort?: { field: keyof Row & string; dir: "asc" | "desc" } | null;
  select?: readonly (keyof Row & string)[];
  includeDeleted?: boolean;
}

export interface ResourceController<Row extends Record<string, unknown>> {
  list(options?: ResourceListOptions<Row>): Promise<FlowpanelResult<ListResult<Partial<Row>>>>;
  get(
    id: string,
    options?: { select?: readonly (keyof Row & string)[] },
  ): Promise<FlowpanelResult<Partial<Row>>>;
  create(input: Partial<Row>): Promise<FlowpanelResult<Partial<Row>>>;
  update(id: string, input: Partial<Row>): Promise<FlowpanelResult<Partial<Row>>>;
  delete(id: string): Promise<FlowpanelResult<null>>;
  restore(id: string): Promise<FlowpanelResult<null>>;
  action<T = unknown>(
    id: string,
    action: string,
    input?: Record<string, unknown>,
  ): Promise<FlowpanelResult<T>>;
  bulk<T = unknown>(
    ids: string[],
    action: string,
    input?: Record<string, unknown>,
  ): Promise<FlowpanelResult<T>>;
}

function requestId(ctx: RequestContext): string {
  return ctx.requestId ?? "unknown";
}

function exposure(resource: ResourceConfig, config: ResolvedAdminConfig): string[] {
  const fields = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value) fields.add(value);
    else if (value && typeof value === "object") {
      const field = (value as { field?: unknown }).field;
      if (typeof field === "string" && field) fields.add(field);
    }
  };
  for (const value of resource.options.columns ?? []) add(value);
  for (const value of resource.options.expose ?? []) add(value);
  fields.add(
    String(
      resource.options.rowKey ??
        config.adapter.introspect(resource.ref).primaryKey ??
        DEFAULT_RESOURCE_ROW_KEY,
    ),
  );
  return [...fields];
}

async function selectedFields(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  ctx: RequestContext,
  requested?: readonly string[],
): Promise<string[]> {
  const allowed = exposure(resource, config);
  const allowedSet = new Set(allowed);
  const selected = requested ? [...new Set(requested)] : allowed;
  if (selected.length > MAX_COLUMNS) {
    throw new FlowpanelUnknownFieldError("select");
  }
  for (const field of selected) {
    if (!allowedSet.has(field)) throw new FlowpanelUnknownFieldError(field);
  }
  return filterReadableProjection(selected, resource.options.fieldAccess, ctx);
}

async function execute<T>(
  config: ResolvedAdminConfig,
  ctx: RequestContext,
  operation: string,
  run: () => Promise<T>,
): Promise<FlowpanelResult<T>> {
  const id = requestId(ctx);
  try {
    return { ok: true, data: await run(), meta: { requestId: id } };
  } catch (error) {
    await reportUnexpectedError(
      error,
      {
        requestId: id,
        operation,
        method: ctx.req.method,
        url: ctx.req.url,
        actorId: actorIdFromSession(ctx.session, config.auth.userId),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      config.hooks?.onError,
    );
    return errorResult(error, id) as FlowpanelResult<T>;
  }
}

async function authorizeRead(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  ctx: RequestContext,
): Promise<void> {
  requireAuthorized(config, resource, ctx);
  await authorizeOperation(
    resolveOperationAccess(resource.options.access, resource.options.requireRole, "read"),
    ctx,
  );
}

export function createResourceController<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  ctx: RequestContext,
): ResourceController<Row> {
  const actions = makeActions(config, resource, { reqCtx: ctx });
  const customActions = createActionController(
    config,
    ctx,
    resource.options.name ?? config.adapter.introspect(resource.ref).name,
  );

  return {
    list(options = {}) {
      return execute(config, ctx, "resource.list", async () => {
        await authorizeRead(config, resource, ctx);
        const page =
          Number.isInteger(options.page) && Number(options.page) > 0 ? Number(options.page) : 1;
        const requestedSize = Number(
          options.pageSize ?? resource.options.pageSize ?? DEFAULT_RESOURCE_PAGE_SIZE,
        );
        const pageSize =
          Number.isInteger(requestedSize) && requestedSize > 0 && requestedSize <= MAX_PAGE_SIZE
            ? requestedSize
            : Math.min(resource.options.pageSize ?? DEFAULT_RESOURCE_PAGE_SIZE, MAX_PAGE_SIZE);
        const select = await selectedFields(
          config,
          resource,
          ctx,
          options.select as readonly string[] | undefined,
        );
        const softDelete = resource.options.delete?.softDelete;
        const query: ListQueryContext<unknown> = {
          ...ctx,
          db: config.adapter.db,
          dateRange: { from: new Date(0), to: new Date() },
          searchParams: new URL(ctx.req.url).searchParams,
          signal: ctx.req.signal,
          filters: options.filters ?? {},
          sort: (options.sort ??
            resource.options.defaultSort ??
            null) as ListQueryContext<unknown>["sort"],
          page,
          pageSize,
          search: options.search ?? "",
          select,
          ...(resource.options.search ? { searchFields: resource.options.search as string[] } : {}),
          ...(softDelete
            ? { softDelete: { column: String(softDelete) }, includeDeleted: options.includeDeleted }
            : {}),
          ...scopeBinding(config, resource, ctx),
        };
        const result = await runWithRequestContext(ctx, () =>
          config.adapter.list(resource.ref, query),
        );
        const rows = await Promise.all(
          (result.rows as Record<string, unknown>[]).map((row) =>
            projectAuthorizedRow(resource, row, ctx, select),
          ),
        );
        return { ...result, rows } as ListResult<Partial<Row>>;
      });
    },

    get(id, options = {}) {
      return execute(config, ctx, "resource.get", async () => {
        await authorizeRead(config, resource, ctx);
        const select = await selectedFields(
          config,
          resource,
          ctx,
          options.select as readonly string[] | undefined,
        );
        const query: ItemQueryContext = {
          ...ctx,
          db: config.adapter.db,
          dateRange: { from: new Date(0), to: new Date() },
          searchParams: new URL(ctx.req.url).searchParams,
          signal: ctx.req.signal,
          id,
          select,
          ...scopeBinding(config, resource, ctx),
        };
        const row = (await runWithRequestContext(ctx, () =>
          config.adapter.get(resource.ref, query),
        )) as Record<string, unknown> | null;
        if (!row) throw new FlowpanelNotFoundError();
        return projectAuthorizedRow(resource, row, ctx, select) as Promise<Partial<Row>>;
      });
    },

    create(input) {
      return execute(config, ctx, "resource.create", async () => {
        const row = (await actions.create(input)) as Record<string, unknown>;
        return projectAuthorizedRow(resource, row, ctx) as Promise<Partial<Row>>;
      });
    },

    update(id, input) {
      return execute(config, ctx, "resource.update", async () => {
        const row = (await actions.update(id, input)) as Record<string, unknown>;
        return projectAuthorizedRow(resource, row, ctx) as Promise<Partial<Row>>;
      });
    },

    delete(id) {
      return execute(config, ctx, "resource.delete", async () => {
        await actions.delete(id);
        return null;
      });
    },
    restore: customActions.restore,
    action: customActions.row,
    bulk: customActions.bulk,
  };
}
