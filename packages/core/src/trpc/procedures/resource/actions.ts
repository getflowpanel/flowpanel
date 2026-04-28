/**
 * The four action variants — mutation, bulk, collection, dialog.
 *
 * Each one checks per-action access (the action ID doubles as an
 * `access[<id>]` key), verifies the action type matches the procedure,
 * fetches rows where applicable with row-level security, evaluates
 * `when` predicates, and forwards to the user's handler.
 */

import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { Row } from "../../../resource/types";
import type { Session } from "../../../types/config";
import type { FlowPanelContext } from "../../context";
import {
  checkAccess,
  getAdapter,
  getResource,
  getRowLevelFilters,
  getSessionRoles,
  maybePublish,
  rowPassesRowLevel,
} from "./helpers";
import {
  actionInputSchema,
  bulkActionInputSchema,
  collectionActionInputSchema,
  dialogActionInputSchema,
} from "./schemas";

type AuthedCtx = FlowPanelContext & { session: Session };

export function createActionProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  authedProcedure: any,
) {
  return {
    action: authedProcedure
      .input(actionInputSchema)
      .mutation(
        async ({ ctx, input }: { ctx: AuthedCtx; input: z.infer<typeof actionInputSchema> }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access[input.actionId], roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not allowed to perform action "${input.actionId}".`,
            });
          }

          const action = resource.actions.find((a) => a.id === input.actionId);
          if (!action) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Action "${input.actionId}" not found on resource "${input.resourceId}".`,
            });
          }
          if (action.type !== "mutation") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Action "${input.actionId}" is not a per-row mutation. Use action.${action.type} procedure instead.`,
            });
          }
          const handler = resource._handlers[input.actionId];
          if (!handler) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Action "${input.actionId}" handler missing.`,
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

          const whenPredicate = resource._whens[input.actionId];
          if (whenPredicate && !whenPredicate(row)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Action "${input.actionId}" is not available for this record.`,
            });
          }

          const result = await handler(row, ctx);
          await maybePublish(ctx, resource, input.resourceId, {
            op: "action",
            id: input.recordId,
            actionId: input.actionId,
          });
          return result ?? { success: true };
        },
      ),

    actionBulk: authedProcedure
      .input(bulkActionInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: AuthedCtx;
          input: z.infer<typeof bulkActionInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access[input.actionId], roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not allowed to perform action "${input.actionId}".`,
            });
          }

          const action = resource.actions.find((a) => a.id === input.actionId);
          if (!action || action.type !== "bulk") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Action "${input.actionId}" is not a bulk action.`,
            });
          }

          const metadata = adapter.getModelMetadata(resource.modelName);
          const pk = metadata.primaryKey;
          const rowLevel = getRowLevelFilters(ctx, input.resourceId);

          const rowsResult = await adapter.findMany(resource.modelName, {
            where: [{ field: pk, op: "in", value: input.recordIds }, ...rowLevel],
            include: resource.include,
            take: input.recordIds.length,
          });

          const handler = action.handler as (rows: Row[], ctx: unknown) => Promise<unknown>;
          const result = await handler(rowsResult.data, ctx);
          return result ?? { success: true, affected: rowsResult.data.length };
        },
      ),

    actionCollection: authedProcedure
      .input(collectionActionInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: AuthedCtx;
          input: z.infer<typeof collectionActionInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access[input.actionId], roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not allowed to perform action "${input.actionId}".`,
            });
          }

          const action = resource.actions.find((a) => a.id === input.actionId);
          if (!action || action.type !== "collection") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Action "${input.actionId}" is not a collection action.`,
            });
          }

          const handler = action.handler as (ctx: unknown) => Promise<unknown>;
          const result = await handler(ctx);
          return result ?? { success: true };
        },
      ),

    actionDialog: authedProcedure
      .input(dialogActionInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: AuthedCtx;
          input: z.infer<typeof dialogActionInputSchema>;
        }) => {
          const resource = getResource(ctx, input.resourceId);
          const adapter = getAdapter(ctx);
          const roles = getSessionRoles(ctx.session);

          if (!checkAccess(resource.access[input.actionId], roles, ctx)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not allowed to perform action "${input.actionId}".`,
            });
          }

          const action = resource.actions.find((a) => a.id === input.actionId);
          if (!action || action.type !== "dialog") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Action "${input.actionId}" is not a dialog action.`,
            });
          }

          for (const field of action.schema.fields) {
            if (field.required && input.values[field.name] == null) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Field "${field.name}" is required.`,
              });
            }
          }

          let row: Row | null = null;
          if (input.recordId !== undefined) {
            const metadata = adapter.getModelMetadata(resource.modelName);
            const pk = metadata.primaryKey;
            row = await adapter.findUnique(resource.modelName, {
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
          }

          const handler = action.handler as (
            values: Record<string, unknown>,
            row: Row | null,
            ctx: unknown,
          ) => Promise<unknown>;
          const result = await handler(input.values, row, ctx);
          return result ?? { success: true };
        },
      ),
  };
}
