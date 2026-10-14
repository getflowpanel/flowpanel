import { DEFAULT_LABELS, RU_LABELS } from "@flowpanel/core/labels";
import { describe, expect, it } from "vitest";
import { readActionFailure as read } from "../actions/read-action-failure";

const errors = DEFAULT_LABELS.errors;
const readActionFailure = (body: unknown) => read(body, errors);

describe("readActionFailure", () => {
  it("reads the route shape", () => {
    expect(
      readActionFailure({
        ok: false,
        error: "validation failed",
        fieldErrors: { reason: "Pick one" },
      }),
    ).toEqual({ message: "validation failed", fieldErrors: { reason: "Pick one" } });
  });

  it("reads the older envelope and issues list, sending a whole-input issue to the message", () => {
    expect(
      readActionFailure({ ok: false, error: { code: "bad_request", message: "gone" } }),
    ).toEqual({ message: "gone" });
    expect(
      readActionFailure({
        ok: false,
        issues: [
          { path: [], message: "input must be an object" },
          { path: ["status"], message: "status is required" },
        ],
      }),
    ).toEqual({
      message: "input must be an object",
      fieldErrors: { status: "status is required" },
    });
  });

  it("words a refusal the kit names by code in the admin's language, and keeps the host's own error", () => {
    const ru = { ...errors, ...RU_LABELS.errors };
    expect(read({ ok: false, error: "not found", code: "not_found" }, ru)).toEqual({
      message: ru.notFound,
    });
    expect(read({ ok: false, error: "Rate limit exceeded", code: "rate_limited" }, ru)).toEqual({
      message: ru.rateLimited,
    });
    expect(read({ ok: false, error: "x", code: "operation_disabled" }, errors).message).toBe(
      "This change is turned off here.",
    );
    expect(read({ ok: false, error: "Refunds over $500 need finance." }, ru)).toEqual({
      message: "Refunds over $500 need finance.",
    });
  });

  it("ignores what is not a failure body", () => {
    expect(readActionFailure("Bad Gateway")).toEqual({});
    expect(readActionFailure(null)).toEqual({});
  });
});
