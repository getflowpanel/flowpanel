import { describe, expect, it } from "vitest";

describe("runs procedures", () => {
	it("createRunsProcedures returns an object with list, get, retry, cancel, and bulkRetry", async () => {
		const { createRunsProcedures } = await import("../../trpc/procedures/runs.js");

		// Mock procedure builder
		const mockProcedure = {
			// biome-ignore lint/suspicious/noExplicitAny: test mock procedure cast
			input: (_schema: any) => ({
				// biome-ignore lint/suspicious/noExplicitAny: test mock procedure cast
				query: (fn: any) => ({ _def: { meta: { type: "query" } }, fn }),
				// biome-ignore lint/suspicious/noExplicitAny: test mock procedure cast
				mutation: (fn: any) => ({ _def: { meta: { type: "mutation" } }, fn }),
			}),
		};

		// Mock router builder
		// biome-ignore lint/suspicious/noExplicitAny: test mock procedure cast
		const mockRouter = (routes: any) => routes;

		const procs = createRunsProcedures(
			// biome-ignore lint/suspicious/noExplicitAny: test mock procedure cast
			{ procedure: mockProcedure, router: mockRouter } as any,
			// biome-ignore lint/suspicious/noExplicitAny: test mock procedure cast
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
