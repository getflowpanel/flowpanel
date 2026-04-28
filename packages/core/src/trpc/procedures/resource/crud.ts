/**
 * CRUD procedures for a resource: list, get, create, update, delete.
 *
 * Every procedure follows the same narrative:
 *   1. Look up resource + adapter + session roles.
 *   2. Check `access.<op>` — 403 on refusal.
 *   3. (mutations) Strip non-writable fields via `filterWritableData`.
 *   4. Enforce row-level security by fetching + comparing, or by injecting
 *      rowLevel filters into the where clause.
 *   5. Call the adapter.
 *   6. `maybePublish` to the SSE broker (only if resource has realtime: true).
 *   7. `applyComputes` so the client sees computed columns in the response.
 *
 * Shared helpers live in `./helpers.ts`, zod input schemas in `./schemas.ts`.
 */

import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { NormalizedFilter } from "../../../resource/types";
import type { Session } from "../../../types/config";
import type { FlowPanelContext } from "../../context";
import {
  applyComputes,
  buildFilters,
  checkAccess,
  filterWritableData,
  getAdapter,
  getResource,
  getRowLevelFilters,
  getSessionRoles,
  maybePublish,
  rowPassesRowLevel,
} from "./helpers";
import {
  createInputSchema,
  deleteInputSchema,
  getInputSchema,
  listInputSchema,
  updateInputSchema,
} from "./schemas";

type AuthedCtx = FlowPanelContext & { session: Session };

export function createCrudProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  authedProcedure: any,
) {
  return {
    list: authedProcedure
      .input(listInputSchema)
      .query(async ({ ctx, input }: { ctx: AuthedCtx; input: z.infer<typeof listInputSchema> }) => {
        const resource = getResource(ctx, input.resourceId);
        const adapter = getAdapter(ctx);
        const roles = getSessionRoles(ctx.session);

        if (!checkAccess(resource.access.list, roles, ctx)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not allowed to list this resource.",
          });
        }

        const { where, searchOr } = buildFilters(
          input.filters as NormalizedFilter[] | undefined,
          input.search,
          resource,
        );
        where.push(...getRowLevelFilters(ctx, input.resourceId));

        const sort = input.sort ?? resource.defaultSort;
        const pageSize = input.pageSize ?? resource.defaultPageSize;
        const skip = (input.page - 1) * pageSize;

        const { data, total } = await adapter.findMany(resource.modelName, {
          where: where.length > 0 ? where : undefined,
          searchOr: searchOr.length > 0 ? searchOr : undefined,
          orderBy: sort,
          skip,
          take: pageSize,
          include: resource.include,
        });

        const rows = data.map((row) => applyComputes(resource, row));

        return {
          data: rows,
          total,
          page: input.page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }),

    get: authedProcedure
      .input(getInputSchema)
      .query(async ({ ctx, input }: { ctx: AuthedCtx; input: z.infer<typeof getInputSchema> }) => {
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

        const rowLevel = getRowLevelFilters(ctx, input.resourceId);
        if (rowLevel.length > 0 && !rowPassesRowLevel(row, rowLevel)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
        }

        return applyComputes(resource, row);
      }),

    create: authedProcedure
      .input(createInputSchema)
      .mutation(
        async ({ ctx, input }: { ctx: AuthedCtx; input: z.infer<typeof createInputSchema> }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access.create, roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not allowed to create this resource.",
            });
          }

          const metadata = adapter.getModelMetadata(resource.modelName);
          const safeData = filterWritableData(input.data, metadata);

          // Force-apply rowLevel scalars so a user can't escape their scope.
          const rowLevel = getRowLevelFilters(ctx, input.resourceId);
          for (const f of rowLevel) {
            if (f.op === "eq") {
              safeData[f.field] = f.value;
            }
          }

          const row = await adapter.create(resource.modelName, { data: safeData });
          await maybePublish(ctx, resource, input.resourceId, {
            op: "create",
            id: row[metadata.primaryKey] as string | number,
          });
          return applyComputes(resource, row);
        },
      ),

    update: authedProcedure
      .input(updateInputSchema)
      .mutation(
        async ({ ctx, input }: { ctx: AuthedCtx; input: z.infer<typeof updateInputSchema> }) => {
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

          // rowLevel: fetch + check before mutating so "invisible" rows are
          // indistinguishable from "missing" ones.
          const rowLevel = getRowLevelFilters(ctx, input.resourceId);
          if (rowLevel.length > 0) {
            const existing = await adapter.findUnique(resource.modelName, {
              where: { [pk]: input.recordId },
            });
            if (!existing || !rowPassesRowLevel(existing, rowLevel)) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
            }
          }

          const safeData = filterWritableData(input.data, metadata);
          const row = await adapter.update(resource.modelName, {
            where: { [pk]: input.recordId },
            data: safeData,
          });
          await maybePublish(ctx, resource, input.resourceId, {
            op: "update",
            id: input.recordId,
          });
          return applyComputes(resource, row);
        },
      ),

    delete: authedProcedure
      .input(deleteInputSchema)
      .mutation(
        async ({ ctx, input }: { ctx: AuthedCtx; input: z.infer<typeof deleteInputSchema> }) => {
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

          const rowLevel = getRowLevelFilters(ctx, input.resourceId);
          if (rowLevel.length > 0) {
            const existing = await adapter.findUnique(resource.modelName, {
              where: { [pk]: input.recordId },
            });
            if (!existing || !rowPassesRowLevel(existing, rowLevel)) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
            }
          }

          await adapter.delete(resource.modelName, {
            where: { [pk]: input.recordId },
          });

          await maybePublish(ctx, resource, input.resourceId, {
            op: "delete",
            id: input.recordId,
          });
          return { success: true as const };
        },
      ),
  };
}
