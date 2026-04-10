import { TRPCError } from "@trpc/server";
import type { FlowPanelContext } from "../context.js";

export interface AuthMiddlewareResult {
	session: import("../../types/config.js").Session;
}

// biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
export function createAuthMiddleware(t: { middleware: (fn: (opts: any) => any) => any }) {
	// biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
	return t.middleware(async ({ ctx, next }: { ctx: FlowPanelContext; next: any }) => {
		const { config, req } = ctx;

		let session: import("../../types/config.js").Session | null = null;
		try {
			session = await (
				config.security.auth.getSession as (
					req: Request,
				) => Promise<import("../../types/config.js").Session | null>
			)(req);
		} catch {
			throw new TRPCError({ code: "UNAUTHORIZED", message: "Session check failed" });
		}

		if (!session) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message:
					"Not authenticated. Check that security.auth.getSession() returns a session object with { id, role? }.",
			});
		}

		const requiredRole = config.security.auth.requireRole;
		if (requiredRole && session.role !== requiredRole) {
			// Check permissions table
			const perms = config.security.permissions?.[session.role];
			if (!perms) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
		}

		return next({ ctx: { ...ctx, session } });
	});
}
