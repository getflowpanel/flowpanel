import { describe, expect, it, vi } from "vitest";
import {
  requireSandboxId,
  sandboxField,
  sandboxImportConfig,
  sandboxResourcePolicy,
  sandboxScope,
} from "../scope";

describe("fail-closed demo sandbox scope", () => {
  it("accepts only the local id or a canonical public UUID", () => {
    expect(requireSandboxId({ sandboxId: "local" })).toBe("local");
    expect(requireSandboxId({ sandboxId: "9f34ca6a-a3de-4ac1-a8b4-61bd83fa5174" })).toMatch(
      /^[0-9a-f-]+$/,
    );
    expect(() => requireSandboxId(null)).toThrow(/sandbox scope/i);
    expect(() => requireSandboxId({ sandboxId: "forged" })).toThrow(/sandbox scope/i);
  });

  it("resolves the hidden create field from request scope", async () => {
    const field = sandboxField<Record<string, unknown>>();
    expect(field.type).toBe("hidden");
    expect(typeof field.defaultValue).toBe("function");
    const resolve = field.defaultValue as (ctx: unknown) => Promise<unknown>;
    await expect(resolve({ scope: { sandboxId: "local" } })).resolves.toBe("local");
  });

  it("builds a resource policy that scopes rows and hides internal ownership fields", () => {
    const policy = sandboxResourcePolicy({ name: "sandbox column" } as never);
    expect(typeof policy.scope).toBe("function");
    expect(policy.fieldAccess.sandboxId).toMatchObject({ read: false, write: false });
    expect(policy.fieldAccess.seedKey).toMatchObject({ read: false, write: false });
  });

  it("applies the Drizzle predicate through query.where", () => {
    const where = vi.fn((condition: unknown) => condition);
    const predicate = sandboxScope({ name: "sandbox column" } as never);

    predicate({ sandboxId: "local" }, { where });

    expect(where).toHaveBeenCalledOnce();
  });

  it("disables bulk import in public mode but leaves local import unchanged", () => {
    const local = { formats: ["csv" as const], fields: ["email"] };
    expect(sandboxImportConfig(local, false)).toBe(local);
    expect(sandboxImportConfig(local, true)).toBe(false);
  });
});
