import { describe, expect, it, vi } from "vitest";
import { authorizeOperation, resolveOperationAccess } from "../../policy/access.js";
import { FlowpanelAccessError } from "../../types/error.js";
import type { ResourceAccess } from "../../types/policy.js";
import { type MutationPipelineStage, runMutationPipeline } from "../operation-pipeline.js";

const accessContext = {
  session: { user: { id: "user_1" } },
  role: "operator",
  scope: { tenantId: "tenant_1" },
};

describe("operation access", () => {
  it("supports exact roles and contextual predicates", async () => {
    const access: ResourceAccess = {
      read: ["admin", "operator"],
      update: ({ session, scope }) => Boolean(session && scope?.tenantId),
      delete: "admin",
    };

    await expect(authorizeOperation(access.update, accessContext)).resolves.toBeUndefined();
    await expect(authorizeOperation(access.delete, accessContext)).rejects.toBeInstanceOf(
      FlowpanelAccessError,
    );
  });

  it("maps requireRole to every operation but rejects ambiguous declarations", () => {
    expect(resolveOperationAccess(undefined, "operator", "create")).toBe("operator");
    expect(() => resolveOperationAccess({ create: "admin" }, "operator", "create")).toThrow(
      /cannot declare both/i,
    );
  });
});

describe("mutation pipeline", () => {
  it("runs security stages in their fixed order", async () => {
    const calls: MutationPipelineStage[] = [];
    const stage =
      <T>(name: MutationPipelineStage, value: T) =>
      async () => {
        calls.push(name);
        return value;
      };

    const result = await runMutationPipeline({
      requestId: "req_1",
      transport: stage("transport", undefined),
      authenticate: stage("auth", accessContext),
      authorizeAdmin: stage("admin_access", undefined),
      rateLimit: stage("rate_limit", undefined),
      resolveRoute: stage("route", { resource: "customers" }),
      authorizeResource: stage("resource_access", undefined),
      authorizeOperation: stage("operation_access", undefined),
      assertWritable: stage("writable", undefined),
      loadCurrent: stage("load_current", { id: "1" }),
      authorizeFields: stage("field_access", { email: "new@example.com" }),
      prepareInput: stage("prepare_input", { email: "new@example.com" }),
      execute: stage("execute", { id: "1", email: "new@example.com" }),
    });

    expect(calls).toEqual([
      "transport",
      "auth",
      "admin_access",
      "rate_limit",
      "route",
      "resource_access",
      "operation_access",
      "writable",
      "load_current",
      "field_access",
      "prepare_input",
      "execute",
    ]);
    expect(result).toMatchObject({ ok: true, data: { id: "1" }, meta: { requestId: "req_1" } });
  });

  it("attempts every post-commit effect and returns typed warnings", async () => {
    const realtime = vi.fn(async () => {});
    const revalidate = vi.fn(async () => {
      throw new Error("cache unavailable");
    });

    const result = await runMutationPipeline({
      requestId: "req_2",
      transport: async () => {},
      authenticate: async () => accessContext,
      authorizeAdmin: async () => {},
      rateLimit: async () => {},
      resolveRoute: async () => ({}),
      authorizeResource: async () => {},
      authorizeOperation: async () => {},
      assertWritable: async () => {},
      loadCurrent: async () => null,
      authorizeFields: async () => ({}),
      prepareInput: async () => ({}),
      execute: async () => ({ id: "created" }),
      effects: [
        {
          code: "audit_failed",
          run: async () => {
            throw new Error("sink unavailable");
          },
        },
        { code: "realtime_failed", run: realtime },
        { code: "revalidation_failed", run: revalidate },
      ],
    });

    expect(realtime).toHaveBeenCalledOnce();
    expect(revalidate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      ok: true,
      meta: {
        warnings: [
          { code: "audit_failed", message: "A post-commit effect failed." },
          { code: "revalidation_failed", message: "A post-commit effect failed." },
        ],
      },
    });
  });
});
