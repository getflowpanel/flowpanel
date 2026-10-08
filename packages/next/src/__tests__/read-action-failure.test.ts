import { describe, expect, it } from "vitest";
import { readActionFailure } from "../actions/read-action-failure";

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
    expect(readActionFailure({ ok: false, error: { code: "not_found", message: "gone" } })).toEqual(
      {
        message: "gone",
      },
    );
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

  it("ignores what is not a failure body", () => {
    expect(readActionFailure("Bad Gateway")).toEqual({});
    expect(readActionFailure(null)).toEqual({});
  });
});
