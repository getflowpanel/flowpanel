import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  parseActionInputSchema,
  validateActionInput,
  validateActionOutput,
} from "../runtime/action-schema.js";

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

describe("canonical action schemas", () => {
  it("rejects undeclared action fields instead of passing them to trusted code", async () => {
    await expect(
      parseActionInputSchema([{ name: "reason" }], undefined, {
        reason: "manual",
        injected: "secret",
      }),
    ).rejects.toMatchObject({ code: "unknown_field", field: "injected" });
  });

  it("validates cross-field input and passes transformed data to the handler", async () => {
    const schema = z
      .object({ from: z.coerce.number(), to: z.coerce.number() })
      .refine(({ from, to }) => from <= to, { message: "from must not exceed to", path: ["to"] });

    await expect(
      parseActionInputSchema(undefined, schema, { from: "2", to: "5" }),
    ).resolves.toEqual({ data: { from: 2, to: 5 }, issues: null });
    await expect(
      parseActionInputSchema(undefined, schema, { from: 7, to: 5 }),
    ).resolves.toMatchObject({ issues: [{ path: ["to"], message: "from must not exceed to" }] });
  });

  it("requires and applies outputSchema before arbitrary action data crosses the wire", () => {
    expect(() => validateActionOutput(undefined, { ok: true, data: { secret: true } })).toThrow(
      /without declaring outputSchema/,
    );
    expect(
      validateActionOutput(z.object({ count: z.coerce.number() }), {
        ok: true,
        data: { count: "3", ignored: true },
      }),
    ).toEqual({ ok: true, data: { count: 3 } });
  });
});
