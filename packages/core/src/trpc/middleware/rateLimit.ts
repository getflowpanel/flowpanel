import { TRPCError } from "@trpc/server";
import type { FlowPanelContext } from "../context.js";

// In-memory fallback rate limiter (production should use Redis)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = memoryStore.get(key);
  if (!record || record.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

// biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
export function createRateLimitMiddleware(t: { middleware: (fn: (opts: any) => any) => any }) {
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
      const config = ctx.config;
      // biome-ignore lint/suspicious/noExplicitAny: tRPC middleware internal type
      const rateLimits = (config.security as any)?.rateLimits ?? {};
      const limitConfig = rateLimits[path];

      if (limitConfig && ctx.session) {
        const userId = ctx.session.userId;

        if (limitConfig.perMinute) {
          const key = `rl:${path}:${userId}:min`;
          if (!checkRateLimit(key, limitConfig.perMinute, 60_000)) {
            // Log to audit log
            await ctx.db.execute(
              `INSERT INTO flowpanel_audit_log (user_id, user_role, action, result)
             VALUES ($1, $2, $3, 'denied')`,
              [userId, ctx.session.role, path],
            );
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: `Rate limit exceeded: ${limitConfig.perMinute} requests per minute`,
            });
          }
        }

        if (limitConfig.perHour) {
          const key = `rl:${path}:${userId}:hour`;
          if (!checkRateLimit(key, limitConfig.perHour, 3_600_000)) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: `Rate limit exceeded: ${limitConfig.perHour} requests per hour`,
            });
          }
        }
      }

      return next();
    },
  );
}
