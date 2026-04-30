import { describe, expect, it } from "vitest";
import type { RequestContext } from "../../types/context.js";
import {
  getRequestContext,
  runWithRequestContext,
  tryGetRequestContext,
} from "../request-context.js";

function makeCtx(): RequestContext {
  return {
    req: new Request("http://x/"),
    session: null,
    role: "admin",
    scope: null,
    ip: null,
    userAgent: null,
  };
}

describe("request context", () => {
  it("propagates through async boundaries", async () => {
    const ctx = makeCtx();
    await runWithRequestContext(ctx, async () => {
      expect(getRequestContext()).toBe(ctx);
      await new Promise((r) => setTimeout(r, 1));
      expect(getRequestContext()).toBe(ctx);
    });
  });

  it("nests contexts — inner wins until it returns", async () => {
    const outer = makeCtx();
    const inner = makeCtx();
    await runWithRequestContext(outer, async () => {
      expect(getRequestContext()).toBe(outer);
      await runWithRequestContext(inner, async () => {
        expect(getRequestContext()).toBe(inner);
      });
      expect(getRequestContext()).toBe(outer);
    });
  });

  it("getRequestContext throws outside a context", () => {
    expect(() => getRequestContext()).toThrow(/outside/i);
  });

  it("tryGetRequestContext returns null outside a context", () => {
    expect(tryGetRequestContext()).toBeNull();
  });
});
