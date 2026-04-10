import { describe, expect, it } from "vitest";

describe("runs procedures", () => {
  it("createRunsProcedures returns an object with list, get, retry, cancel, and bulkRetry", async () => {
    const { createRunsProcedures } = await import("../../trpc/procedures/runs.js");

    // Mock procedure builder
    const mockProcedure = {
      input: (_schema: any) => ({
        query: (fn: any) => ({ _def: { meta: { type: "query" } }, fn }),
        mutation: (fn: any) => ({ _def: { meta: { type: "mutation" } }, fn }),
      }),
    };

    // Mock router builder
    const mockRouter = (routes: any) => routes;

    const procs = createRunsProcedures(
      { procedure: mockProcedure, router: mockRouter } as any,
      mockProcedure as any,
    );

    expect(procs).toBeDefined();
    expect(procs.list).toBeDefined();
    expect(procs.get).toBeDefined();
    expect(procs.retry).toBeDefined();
    expect(procs.cancel).toBeDefined();
    expect(procs.bulkRetry).toBeDefined();
  });
});
