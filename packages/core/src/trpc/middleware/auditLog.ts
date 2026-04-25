import type { AuditEvent } from "../../config/auditEvent";
import type { FlowPanelContext } from "../context";

const NON_MUTATION_PREFIXES = [
  "metrics",
  "runs.list",
  "runs.get",
  "stages",
  "users.list",
  "stream",
] as const;

function kindFor(path: string): "mutation" | "query" {
  return NON_MUTATION_PREFIXES.some((p) => path.startsWith(p)) ? "query" : "mutation";
}

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

      const kind = kindFor(path);
      const isMutation = kind === "mutation";

      // biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
      const headers = (ctx.req as any).headers;
      const forwardedFor = headers?.get?.("x-forwarded-for") ?? undefined;
      const userAgent = headers?.get?.("user-agent") ?? undefined;
      const requestId = headers?.get?.("x-request-id") ?? undefined;

      // 1. Existing DB insert — untouched for mutations with a session.
      if (isMutation && ctx.session) {
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
            requestId ?? null,
          ],
        );
      }

      // 2. User-provided audit callback (B3). Runs for every mutation, regardless
      //    of session presence. Failures are logged and swallowed — audit problems
      //    must never break the response.
      const auditFn = ctx.config?.audit;
      if (isMutation && typeof auditFn === "function") {
        const event: AuditEvent = {
          path,
          kind,
          ok: result.ok,
          actor: ctx.session
            ? {
                id: ctx.session.userId,
                email: ctx.session.email,
                role: ctx.session.role,
              }
            : null,
          ip: forwardedFor,
          userAgent,
          requestId,
          at: new Date(),
          ...(result.ok ? {} : { error: String(result.error ?? "unknown") }),
        };
        try {
          await auditFn(event);
        } catch (err) {
          console.error("[flowpanel] config.audit threw — suppressed:", err);
        }
      }

      return result;
    },
  );
}
