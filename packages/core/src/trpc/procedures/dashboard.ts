import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Session } from "../../types/config";
import { evaluateDashboard } from "../../widget/evaluator";
import { serializeDashboard } from "../../widget/serializer";
import type { FlowPanelContext } from "../context";

const dataInputSchema = z
  .object({
    widgetIds: z.array(z.string()).optional(),
  })
  .optional();

export function createDashboardProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  t: { procedure: any; router: (routes: any) => any },
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  authedProcedure: any,
) {
  return t.router({
    /**
     * Returns the dashboard layout (widget definitions, no data).
     */
    schema: authedProcedure
      .input(z.object({}).optional())
      .query(async ({ ctx }: { ctx: FlowPanelContext & { session: Session } }) => {
        const widgets = ctx.dashboard ?? [];
        return { widgets: serializeDashboard(widgets) };
      }),

    /**
     * Runs all widget data-loaders and returns their payloads keyed by widget id.
     * Pass `widgetIds` to evaluate a subset.
     */
    data: authedProcedure
      .input(dataInputSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input?: z.infer<typeof dataInputSchema>;
        }) => {
          const widgets = ctx.dashboard ?? [];
          if (widgets.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "No dashboard widgets configured. Add a `dashboard:` property to defineFlowPanel().",
            });
          }
          return evaluateDashboard(widgets, ctx, input?.widgetIds);
        },
      ),
  });
}
