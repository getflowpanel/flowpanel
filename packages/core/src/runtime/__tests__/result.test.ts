import { describe, expect, it, vi } from "vitest";
import { FlowpanelValidationError } from "../../types/error.js";
import { errorResult, reportUnexpectedError, resultResponse } from "../result.js";

const context = {
  requestId: "req_42",
  operation: "update",
  route: "customers/:id",
  actorId: "user_1",
  method: "PATCH",
  url: "https://example.com/api/flowpanel/customers/1",
  ip: "203.0.113.10",
  userAgent: "test",
} as const;

describe("safe runtime results", () => {
  it("maps validation errors to the canonical envelope and 422 status", async () => {
    const result = errorResult(
      new FlowpanelValidationError({ email: "Invalid email" }),
      context.requestId,
    );
    const response = resultResponse(result);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "validation_failed",
        message: "Validation failed",
        fieldErrors: { email: "Invalid email" },
        requestId: "req_42",
      },
    });
  });

  it("redacts unexpected errors and reports the same failure once", async () => {
    const onError = vi.fn(async () => {});
    const error = new Error("database password: secret");

    await reportUnexpectedError(error, context, onError);
    await reportUnexpectedError(error, context, onError);
    const result = errorResult(error, context.requestId);

    expect(onError).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      ok: false,
      error: { code: "internal", message: "Internal server error", requestId: "req_42" },
    });
    expect(JSON.stringify(result)).not.toContain("database password");
  });
});
