export interface RuntimeDocClaim {
  id: string;
  pages: readonly `/docs/${string}`[];
  testFile: string;
  testName: string;
}

export const RUNTIME_DOC_CLAIMS = [
  {
    id: "authorization-before-input",
    pages: ["/docs/guides/permissions", "/docs/reference/actions"],
    testFile: "packages/next/src/__tests__/with-guards.test.ts",
    testName: "rejects an unauthorized bulk POST with 403 before validating its input",
  },
  {
    id: "tenant-scope-fails-closed",
    pages: ["/docs/guides/multi-tenant-scope", "/docs/reference/scope-realtime"],
    testFile: "packages/adapter-drizzle/src/__tests__/scope.integration.test.ts",
    testName: "FAIL-CLOSED: list throws when scopeRequired && no applyScope",
  },
  {
    id: "field-write-filtering",
    pages: ["/docs/guides/permissions", "/docs/build/forms"],
    testFile: "packages/next/src/__tests__/resource-actions.test.ts",
    testName: "rejects submitted readOnly fields instead of silently stripping them",
  },
  {
    id: "audit-after-mutation",
    pages: ["/docs/build/configuration", "/docs/reference/runtime-contracts"],
    testFile: "packages/next/src/__tests__/resource-actions.test.ts",
    testName: "creates the row, emits audit with target id, and publishes",
  },
  {
    id: "realtime-delivery",
    pages: ["/docs/guides/realtime", "/docs/reference/scope-realtime"],
    testFile: "packages/next/src/__tests__/events-publish-delivery.test.ts",
    testName: "reaches subscribers on the channel the caller named",
  },
] as const satisfies readonly RuntimeDocClaim[];
