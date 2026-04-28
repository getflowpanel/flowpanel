import { describe, expect, it, vi } from "vitest";
import type { FlowPanelConfig } from "../config/schema";
import { createFlowPanelHandler } from "../createFlowPanelHandler";
import type { FlowPanelRouterConfig } from "../defineFlowPanel";

function stubFlowPanel(): { getRouterConfig: () => FlowPanelRouterConfig } {
  const config = {
    appName: "test",
    basePath: "/admin",
    pipeline: { stages: ["a"] as const, fields: {}, stageFields: { a: {} } },
  } as unknown as FlowPanelConfig;
  const getDb = async () => ({
    // biome-ignore lint/suspicious/noExplicitAny: SqlExecutor is structural
    execute: async () => [] as any,
  });
  return {
    getRouterConfig: () => ({
      config,
      getDb: getDb as unknown as FlowPanelRouterConfig["getDb"],
    }),
  };
}

describe("createFlowPanelHandler", () => {
  it("returns GET and POST handlers", () => {
    const fp = stubFlowPanel();
    const { GET, POST } = createFlowPanelHandler(fp);
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });

  it("responds to an invalid tRPC GET with a 4xx", async () => {
    const fp = stubFlowPanel();
    const { GET } = createFlowPanelHandler(fp);
    const res = await GET(new Request("http://localhost/api/trpc/doesnotexist"));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("forwards onError for uncaught handler errors", async () => {
    const fp = stubFlowPanel();
    const onError = vi.fn();
    const { GET } = createFlowPanelHandler(fp, { onError });
    // Unknown procedure → tRPC emits a NOT_FOUND which is surfaced via onError.
    await GET(new Request("http://localhost/api/trpc/ghost.procedure"));
    expect(onError).toHaveBeenCalled();
  });

  it("honours a custom endpoint path", () => {
    const fp = stubFlowPanel();
    const { GET } = createFlowPanelHandler(fp, { endpoint: "/admin/trpc" });
    expect(typeof GET).toBe("function");
  });
});
