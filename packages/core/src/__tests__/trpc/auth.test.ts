import { describe, it, expect } from "vitest";
import { createAuthMiddleware } from "../../trpc/middleware/auth.js";
import { TRPCError } from "@trpc/server";

describe("auth middleware", () => {
  it("allows request when getSession returns valid session", async () => {
    const t = {
      middleware: (fn: any) => fn,
    };
    const middleware = createAuthMiddleware(t as any);
    const ctx = {
      config: {
        security: {
          auth: {
            getSession: async () => ({ userId: "user1", role: "admin" }),
            requireRole: "admin",
          },
          permissions: { admin: ["*"] },
        },
      },
      req: new Request("http://localhost/"),
    };

    const result: any = {};
    await middleware({
      ctx,
      next: async ({ ctx: newCtx }: any) => {
        Object.assign(result, newCtx);
        return {};
      },
    });

    expect(result.session?.userId).toBe("user1");
    expect(result.session?.role).toBe("admin");
  });

  it("throws UNAUTHORIZED when getSession returns null", async () => {
    const t = { middleware: (fn: any) => fn };
    const middleware = createAuthMiddleware(t as any);
    const ctx = {
      config: { security: { auth: { getSession: async () => null } } },
      req: new Request("http://localhost/"),
    };

    await expect(
      middleware({ ctx, next: async () => ({}) })
    ).rejects.toThrow();
  });

  it("throws UNAUTHORIZED when getSession throws", async () => {
    const t = { middleware: (fn: any) => fn };
    const middleware = createAuthMiddleware(t as any);
    const ctx = {
      config: {
        security: {
          auth: {
            getSession: async () => {
              throw new Error("network");
            },
          },
        },
      },
      req: new Request("http://localhost/"),
    };

    await expect(
      middleware({ ctx, next: async () => ({}) })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN when session role does not match requireRole", async () => {
    const t = { middleware: (fn: any) => fn };
    const middleware = createAuthMiddleware(t as any);
    const ctx = {
      config: {
        security: {
          auth: {
            getSession: async () => ({ userId: "user1", role: "user" }),
            requireRole: "admin",
          },
          permissions: {},
        },
      },
      req: new Request("http://localhost/"),
    };

    await expect(
      middleware({ ctx, next: async () => ({}) })
    ).rejects.toThrow();
  });
});
