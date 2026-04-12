import type { FlowPanelContext } from "../context.js";

// biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
export function createAuditLogMiddleware(t: { middleware: (fn: (opts: any) => any) => any }) {
  return t.middleware(
    async ({
      ctx,
      next,
      path,
    }: {
      // biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
      ctx: FlowPanelContext & { session: any };
      // biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
      next: any;
      path: string;
    }) => {
      const result = await next();

      const isMutation =
        !path.startsWith("metrics") &&
        !path.startsWith("runs.list") &&
        !path.startsWith("runs.get") &&
        !path.startsWith("stages") &&
        !path.startsWith("users.list") &&
        !path.startsWith("stream");

      if (isMutation && ctx.session) {
        // biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
        const forwardedFor = (ctx.req as any).headers?.get?.("x-forwarded-for");
        // biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
        const userAgent = (ctx.req as any).headers?.get?.("user-agent");

        await ctx.db.execute(
          `INSERT INTO flowpanel_audit_log (user_id, user_role, ip_address, user_agent, action, result, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            ctx.session.userId,
            ctx.session.role,
            forwardedFor ?? null,
            userAgent ?? null,
            path,
            result.ok ? "success" : "error",
            // biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
            (ctx.req as any).headers?.get?.("x-request-id") ?? null,
          ],
        );
      }

      return result;
    },
  );
}
