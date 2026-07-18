import { describe, expect, it } from "vitest";
import { validateActionInput } from "../runtime/action-helpers.js";

describe("validateActionInput", () => {
  it("runs a synchronous function-form validate and returns synchronously (no await needed)", () => {
    const result = validateActionInput(
      [{ name: "amount", validate: (value) => (Number(value) < 0 ? "must be positive" : null) }],
      { amount: -5 },
    );
    expect(result).toEqual([{ path: ["amount"], message: "must be positive" }]);
  });

  it("runs an async function-form validate and returns a promise that resolves to the field error", async () => {
    const result = validateActionInput(
      [
        {
          name: "amount",
          validate: async (value) => (Number(value) < 0 ? "must be positive" : null),
        },
      ],
      { amount: -5 },
    );
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual([{ path: ["amount"], message: "must be positive" }]);
  });

  it("still runs the Zod-schema branch unchanged", () => {
    const zodLike = {
      safeParse: (value: unknown) =>
        value === "bad"
          ? { success: false as const, error: { issues: [{ path: [], message: "bad value" }] } }
          : { success: true as const, data: value },
    };
    const result = validateActionInput([{ name: "status", validate: zodLike as never }], {
      status: "bad",
    });
    expect(result).toEqual([{ path: ["status"], message: "bad value" }]);
  });

  it("passes when the function-form validator returns null", () => {
    const result = validateActionInput([{ name: "amount", validate: () => null }], { amount: 5 });
    expect(result).toBeNull();
  });
});
