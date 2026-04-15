import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { serializeResource } from "../../resource/serializer";
import type {
  AccessRule,
  NormalizedFilter,
  ResolvedResource,
  ResourceAdapter,
  Row,
} from "../../resource/types";
import type { Session } from "../../types/config";
import type { FlowPanelContext } from "../context";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const filterInputSchema = z.object({
  field: z.string(),
  op: z.enum([
    "eq",
    "neq",
    "contains",
    "startsWith",
    "endsWith",
    "in",
    "notIn",
    "gte",
    "lte",
    "gt",
    "lt",
    "isNull",
    "isNotNull",
  ]),
  value: z.unknown(),
});

const listInputSchema = z.object({
  resourceId: z.string(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sort: z
    .object({
      field: z.string(),
      dir: z.enum(["asc", "desc"]),
    })
    .optional(),
  search: z
    .object({
      query: z.string(),
      fields: z.array(z.string()).optional(),
    })
    .optional(),
  filters: z.array(filterInputSchema).optional(),
});

const getInputSchema = z.object({
  resourceId: z.string(),
  recordId: z.union([z.string(), z.number()]),
});

const createInputSchema = z.object({
  resourceId: z.string(),
  data: z.record(z.unknown()),
});

const updateInputSchema = z.object({
  resourceId: z.string(),
  recordId: z.union([z.string(), z.number()]),
  data: z.record(z.unknown()),
});

const deleteInputSchema = z.object({
  resourceId: z.string(),
  recordId: z.union([z.string(), z.number()]),
});

const actionInputSchema = z.object({
  resourceId: z.string(),
  actionId: z.string(),
  recordId: z.union([z.string(), z.number()]),
});

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------

function checkAccess(
  rule: AccessRule | undefined,
  sessionRoles: string[],
  ctx?: { session: Session | null },
  row?: Row,
): boolean {
  if (rule === false) return false;
  if (rule === undefined) return true;
  if (Array.isArray(rule)) return rule.some((r) => sessionRoles.includes(r));
  if (typeof rule === "function") return rule(ctx, row);
  return true;
}

function getSessionRoles(session: Session | null): string[] {
  if (!session) return [];
  return session.role ? [session.role] : [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getResource(ctx: FlowPanelContext, resourceId: string): ResolvedResource {
  if (!ctx.resources) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No resources configured.",
    });
  }
  const resource = ctx.resources[resourceId];
  if (!resource) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Resource "${resourceId}" not found.`,
    });
  }
  return resource;
}

function getAdapter(ctx: FlowPanelContext): ResourceAdapter {
  if (!ctx.resourceAdapter) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "No resource adapter configured.",
    });
  }
  return ctx.resourceAdapter;
}

function applyComputes(resource: ResolvedResource, row: Row): Row {
  const result = { ...row };
  for (const [id, compute] of Object.entries(resource._computes)) {
    result[id] = compute(row);
  }
  return result;
}

function buildFilters(
  inputFilters: NormalizedFilter[] | undefined,
  search: { query: string; fields?: string[] } | undefined,
  resource: ResolvedResource,
): NormalizedFilter[] {
  const filters: NormalizedFilter[] = [];

  // Input filters
  if (inputFilters) {
    filters.push(...inputFilters);
  }

  // Search → contains filters on search fields
  if (search?.query && search.query.length > 0) {
    const searchFields =
      search.fields && search.fields.length > 0 ? search.fields : resource.searchFields;
    for (const field of searchFields) {
      filters.push({ field, op: "contains", value: search.query });
    }
  }

  return filters;
}

// ---------------------------------------------------------------------------
// Procedure creator
// ---------------------------------------------------------------------------

export function createResourceProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  t: { procedure: any; router: (routes: any) => any },
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  authedProcedure: any,
) {
  return t.router({
    // ---- list ---------------------------------------------------------------
    list: authedProcedure
      .input(listInputSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof listInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          // Check list access
          if (!checkAccess(resource.access.list, roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not allowed to list this resource.",
            });
          }

          const filters = buildFilters(
            input.filters as NormalizedFilter[] | undefined,
            input.search,
            resource,
          );
          const sort = input.sort ?? resource.defaultSort;
          const pageSize = input.pageSize ?? resource.defaultPageSize;
          const skip = (input.page - 1) * pageSize;

          const { data, total } = await adapter.findMany(resource.modelName, {
            where: filters.length > 0 ? filters : undefined,
            orderBy: sort,
            skip,
            take: pageSize,
            include: resource.include,
          });

          // Apply computed columns
          const rows = data.map((row) => applyComputes(resource, row));

          return {
            data: rows,
            total,
            page: input.page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          };
        },
      ),

    // ---- get ----------------------------------------------------------------
    get: authedProcedure
      .input(getInputSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof getInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access.read, roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not allowed to read this resource.",
            });
          }

          const metadata = adapter.getModelMetadata(resource.modelName);
          const pk = metadata.primaryKey;

          const row = await adapter.findUnique(resource.modelName, {
            where: { [pk]: input.recordId },
            include: resource.include,
          });

          if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
          }

          return applyComputes(resource, row);
        },
      ),

    // ---- create -------------------------------------------------------------
    create: authedProcedure
      .input(createInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof createInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access.create, roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not allowed to create this resource.",
            });
          }

          const row = await adapter.create(resource.modelName, { data: input.data });
          return applyComputes(resource, row);
        },
      ),

    // ---- update -------------------------------------------------------------
    update: authedProcedure
      .input(updateInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof updateInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access.update, roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not allowed to update this resource.",
            });
          }

          const metadata = adapter.getModelMetadata(resource.modelName);
          const pk = metadata.primaryKey;

          const row = await adapter.update(resource.modelName, {
            where: { [pk]: input.recordId },
            data: input.data,
          });
          return applyComputes(resource, row);
        },
      ),

    // ---- delete -------------------------------------------------------------
    delete: authedProcedure
      .input(deleteInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof deleteInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access.delete, roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not allowed to delete this resource.",
            });
          }

          const metadata = adapter.getModelMetadata(resource.modelName);
          const pk = metadata.primaryKey;

          await adapter.delete(resource.modelName, {
            where: { [pk]: input.recordId },
          });

          return { success: true as const };
        },
      ),

    // ---- action -------------------------------------------------------------
    action: authedProcedure
      .input(actionInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof actionInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          // Check per-action access
          if (!checkAccess(resource.access[input.actionId], roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not allowed to perform action "${input.actionId}".`,
            });
          }

          const handler = resource._handlers[input.actionId];
          if (!handler) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Action "${input.actionId}" not found on resource "${input.resourceId}".`,
            });
          }

          // Fetch the row
          const metadata = adapter.getModelMetadata(resource.modelName);
          const pk = metadata.primaryKey;
          const row = await adapter.findUnique(resource.modelName, {
            where: { [pk]: input.recordId },
            include: resource.include,
          });

          if (!row) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
          }

          // Check `when` predicate
          const whenPredicate = resource._whens[input.actionId];
          if (whenPredicate && !whenPredicate(row)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Action "${input.actionId}" is not available for this record.`,
            });
          }

          const result = await handler(row, ctx);
          return result ?? { success: true };
        },
      ),

    // ---- schema -------------------------------------------------------------
    schema: authedProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }: { ctx: FlowPanelContext & { session: Session } }) => {
        if (!ctx.resources) {
          return { resources: {} };
        }

        const roles = getSessionRoles(ctx.session);
        const serialized: Record<string, ReturnType<typeof serializeResource>> = {};

        for (const [key, resource] of Object.entries(ctx.resources)) {
          serialized[key] = serializeResource(resource, roles);
        }

        return { resources: serialized };
      }),
  });
}
