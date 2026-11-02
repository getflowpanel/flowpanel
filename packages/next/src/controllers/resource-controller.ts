import type {
  FlowpanelResult,
  ItemQueryContext,
  ListResult,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
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
import { DEFAULT_RESOURCE_PAGE_SIZE } from "../runtime/defaults";
import { rowVisibility, withSoftDeleteColumn } from "../runtime/deleted-row";
import { listRows, mayListDeleted } from "../runtime/list-rows";
import { declaredFieldSet, MAX_PAGE } from "../runtime/parse-list-params";
import { projectAuthorizedRow } from "../runtime/project-row";
import {
  resolveReadableFieldSet,
  sanitizeReadableListSearchParams,
} from "../runtime/readable-fields";
import { requireAccessIfSet } from "../runtime/require-access";
import { requireAuthorized } from "../runtime/require-authorized";
import { rowKeyOf } from "../runtime/row-identity";
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

function exposure(resource: ResourceConfig): string[] {
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
  fields.add(rowKeyOf(resource));
  return [...fields];
}

async function selectedFields(
  resource: ResourceConfig,
  ctx: RequestContext,
  requested?: readonly string[],
): Promise<string[]> {
  const allowed = exposure(resource);
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
  requireAuthorized(config, resource);
  await requireAccessIfSet(resolveOperationAccess(resource.options.access, "read"), ctx);
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
        const requestedPage = Number(options.page);
        const page =
          Number.isInteger(requestedPage) && requestedPage > 0
            ? Math.min(requestedPage, MAX_PAGE)
            : 1;
        const requestedSize = Number(
          options.pageSize ?? resource.options.pageSize ?? DEFAULT_RESOURCE_PAGE_SIZE,
        );
        const pageSize =
          Number.isInteger(requestedSize) && requestedSize > 0 && requestedSize <= MAX_PAGE_SIZE
            ? requestedSize
            : Math.min(resource.options.pageSize ?? DEFAULT_RESOURCE_PAGE_SIZE, MAX_PAGE_SIZE);
        const select = await selectedFields(
          resource,
          ctx,
          options.select as readonly string[] | undefined,
        );
        const queryFields = await resolveReadableFieldSet(
          declaredFieldSet(resource.options),
          resource.options.fieldAccess,
          ctx,
        );
        const declaredOnly = (values: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(values).filter(([field]) => queryFields.has(field)));
        const sort = options.sort && !queryFields.has(options.sort.field) ? null : options.sort;
        const listed = await listRows(config, resource, ctx, {
          filters: declaredOnly(options.filters ?? {}),
          ...(sort !== undefined ? { sort } : {}),
          search: options.search ?? "",
          page,
          pageSize,
          fields: select,
          ...(options.includeDeleted && (await mayListDeleted(resource, ctx))
            ? { includeDeleted: true }
            : {}),
          searchParams: sanitizeReadableListSearchParams(
            new URL(ctx.req.url).searchParams,
            queryFields,
            (resource.options.search ?? []).some((field) => queryFields.has(String(field))),
          ),
          signal: ctx.req.signal,
        });
        return {
          rows: listed.rows,
          total: listed.total,
          page: listed.page,
          pageSize: listed.pageSize,
        } as ListResult<Partial<Row>>;
      });
    },

    get(id, options = {}) {
      return execute(config, ctx, "resource.get", async () => {
        await authorizeRead(config, resource, ctx);
        const select = await selectedFields(
          resource,
          ctx,
          options.select as readonly string[] | undefined,
        );
        const query: ItemQueryContext = {
          ...ctx,
          dateRange: { from: new Date(0), to: new Date() },
          searchParams: new URL(ctx.req.url).searchParams,
          signal: ctx.req.signal,
          id,
          select: withSoftDeleteColumn(resource, select),
          ...scopeBinding(resource, ctx),
        };
        const row = (await runWithRequestContext(ctx, () =>
          config.adapter.get(resource.ref, query),
        )) as Record<string, unknown> | null;
        if (!row || (await rowVisibility(resource, row, ctx)) === "hidden") {
          throw new FlowpanelNotFoundError();
        }
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
