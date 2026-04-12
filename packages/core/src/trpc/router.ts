import { initTRPC } from "@trpc/server";
import type { FlowPanelConfig } from "../config/schema.js";
import type { SqlExecutor } from "../types/db.js";
import type { FlowPanelContext } from "./context.js";
import { createAuditLogMiddleware } from "./middleware/auditLog.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createRateLimitMiddleware } from "./middleware/rateLimit.js";
import { createDrawersProcedures } from "./procedures/drawers.js";
import { createMetricsProcedures } from "./procedures/metrics.js";
import { createRunsProcedures } from "./procedures/runs.js";
import { createStagesProcedures } from "./procedures/stages.js";
import { createStreamProcedure } from "./procedures/stream.js";
import { createUsersProcedures } from "./procedures/users.js";

export function createFlowPanelRouter<TContext extends object>({
  t,
  config,
  getRequest,
}: {
  t: ReturnType<typeof initTRPC.context<TContext>>;
  config: { config: FlowPanelConfig; getDb: () => Promise<SqlExecutor> };
  getRequest: (ctx: TContext) => Request;
}) {
  // Create a new tRPC instance scoped to FlowPanelContext
  const fp = initTRPC.context<FlowPanelContext>().create();

  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
  const authMiddleware = createAuthMiddleware(fp as any);
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
  const auditMiddleware = createAuditLogMiddleware(fp as any);
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
  const rateLimitMiddleware = createRateLimitMiddleware(fp as any);

  const authedProcedure = fp.procedure
    .use(authMiddleware)
    .use(rateLimitMiddleware)
    .use(auditMiddleware);

  const router = fp.router({
    // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
    runs: createRunsProcedures(fp as any, authedProcedure),
    // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
    metrics: createMetricsProcedures(fp as any, authedProcedure),
    // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
    drawers: createDrawersProcedures(fp as any, authedProcedure),
    // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
    stages: createStagesProcedures(fp as any, authedProcedure),
    // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
    users: createUsersProcedures(fp as any, authedProcedure),
    // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
    stream: createStreamProcedure(fp as any, authedProcedure),
  });

  // Wrap in a procedure that translates from the user's context to FlowPanelContext
  return (
    // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
    (t as any).procedure
      // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
      .use(async ({ ctx, next }: any) => {
        const req = getRequest(ctx);
        const db = await config.getDb();
        return next({
          ctx: {
            config: config.config,
            db,
            session: null,
            req,
          } as FlowPanelContext,
        });
      })
      // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder cast
      .use(router as any)
  );
}
