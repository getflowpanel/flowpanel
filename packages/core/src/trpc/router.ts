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

	const authMiddleware = createAuthMiddleware(fp as any);
	const auditMiddleware = createAuditLogMiddleware(fp as any);
	const rateLimitMiddleware = createRateLimitMiddleware(fp as any);

	const authedProcedure = fp.procedure
		.use(authMiddleware)
		.use(rateLimitMiddleware)
		.use(auditMiddleware);

	const router = fp.router({
		runs: createRunsProcedures(fp as any, authedProcedure),
		metrics: createMetricsProcedures(fp as any, authedProcedure),
		drawers: createDrawersProcedures(fp as any, authedProcedure),
		stages: createStagesProcedures(fp as any, authedProcedure),
		users: createUsersProcedures(fp as any, authedProcedure),
		stream: createStreamProcedure(fp as any, authedProcedure),
	});

	// Wrap in a procedure that translates from the user's context to FlowPanelContext
	return (t as any).procedure
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
		.use(router as any);
}
