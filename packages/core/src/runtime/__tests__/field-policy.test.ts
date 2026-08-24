import { describe, expect, it } from "vitest";
import { assertWritableInput, filterReadableProjection } from "../../policy/fields.js";
import { FlowpanelFieldAccessError, FlowpanelUnknownFieldError } from "../../types/error.js";
import type { FieldAccessMap, FieldWriteContext } from "../../types/policy.js";

type Customer = {
  id: string;
  email: string;
  status: "active" | "locked";
  internalNote: string;
  passwordHash: string;
};

const baseContext: FieldWriteContext<Customer> = {
  current: null,
  input: {},
  session: { user: { id: "user_1" } },
  role: "operator",
  scope: { tenantId: "tenant_1" },
};

describe("field policy", () => {
  it("rejects undeclared submitted fields instead of silently stripping them", async () => {
    await expect(
      assertWritableInput<Customer>({
        declaredFields: ["email"],
        policies: {},
        input: { email: "new@example.com", isAdmin: true },
        context: baseContext,
      }),
    ).rejects.toBeInstanceOf(FlowpanelUnknownFieldError);
  });

  it("rejects a submitted field when its row-aware write policy fails", async () => {
    const policies: FieldAccessMap<Customer> = {
      email: {
        write: ({ current, role }) => role === "admin" && current?.status !== "locked",
      },
    };

    await expect(
      assertWritableInput<Customer>({
        declaredFields: ["email"],
        policies,
        input: { email: "new@example.com" },
        context: {
          ...baseContext,
          current: {
            id: "1",
            email: "old@example.com",
            status: "locked",
            internalNote: "",
            passwordHash: "secret",
          },
          input: { email: "new@example.com" },
        },
      }),
    ).rejects.toMatchObject({ code: "field_forbidden", field: "email" });
  });

  it("never exposes sensitive fields and applies read policy before projection", async () => {
    const policies: FieldAccessMap<Customer> = {
      internalNote: { read: "admin" },
      passwordHash: { sensitive: true },
    };

    await expect(
      filterReadableProjection<Customer>(
        ["id", "email", "internalNote", "passwordHash"],
        policies,
        baseContext,
      ),
    ).resolves.toEqual(["id", "email"]);
  });

  it("reports the prohibited field without echoing its submitted value", async () => {
    try {
      await assertWritableInput<Customer>({
        declaredFields: ["passwordHash"],
        policies: { passwordHash: { write: false, sensitive: true } },
        input: { passwordHash: "never-log-this" },
        context: { ...baseContext, input: { passwordHash: "never-log-this" } },
      });
      throw new Error("expected field policy failure");
    } catch (error) {
      expect(error).toBeInstanceOf(FlowpanelFieldAccessError);
      expect(String(error)).not.toContain("never-log-this");
    }
  });
});
