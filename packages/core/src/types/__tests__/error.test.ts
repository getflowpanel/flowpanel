import { describe, expect, it } from "vitest";
import {
  FlowpanelAccessError,
  FlowpanelAuthError,
  FlowpanelConflictError,
  FlowpanelError,
  FlowpanelNotFoundError,
  FlowpanelRateLimitError,
  FlowpanelValidationError,
} from "../error";

describe("FlowpanelError", () => {
  it("carries code, safeMessage, and status; defaults status to 500", () => {
    const err = new FlowpanelError("internal", "Something broke");
    expect(err.name).toBe("FlowpanelError");
    expect(err.code).toBe("internal");
    expect(err.safeMessage).toBe("Something broke");
    expect(err.status).toBe(500);
    expect(err.message).toBe("Something broke");
  });

  it("derives status from the exhaustive public code map", () => {
    const err = new FlowpanelError("payload_too_large", "Payload too large");
    expect(err.status).toBe(413);
  });

  it("toJSON exposes code + message (not the stack)", () => {
    const err = new FlowpanelError("bad_request", "oops");
    expect(err.toJSON()).toEqual({ code: "bad_request", message: "oops" });
  });
});

describe("Specialized error subclasses", () => {
  it("FlowpanelValidationError defaults message + status=422 and carries fieldErrors", () => {
    const err = new FlowpanelValidationError({ email: "invalid" });
    expect(err.name).toBe("FlowpanelValidationError");
    expect(err.code).toBe("validation_failed");
    expect(err.status).toBe(422);
    expect(err.message).toBe("Validation failed");
    expect(err.fieldErrors).toEqual({ email: "invalid" });
  });

  it("FlowpanelValidationError accepts a custom message", () => {
    const err = new FlowpanelValidationError({ a: "b" }, "custom");
    expect(err.message).toBe("custom");
  });

  it("FlowpanelAuthError defaults to 401", () => {
    const err = new FlowpanelAuthError();
    expect(err.name).toBe("FlowpanelAuthError");
    expect(err.status).toBe(401);
    expect(err.code).toBe("unauthenticated");
  });

  it("FlowpanelAccessError defaults to 403", () => {
    const err = new FlowpanelAccessError();
    expect(err.name).toBe("FlowpanelAccessError");
    expect(err.status).toBe(403);
    expect(err.code).toBe("forbidden");
  });

  it("FlowpanelNotFoundError defaults to 404", () => {
    const err = new FlowpanelNotFoundError();
    expect(err.name).toBe("FlowpanelNotFoundError");
    expect(err.status).toBe(404);
    expect(err.code).toBe("not_found");
  });

  it("FlowpanelConflictError defaults to 409", () => {
    const err = new FlowpanelConflictError();
    expect(err.name).toBe("FlowpanelConflictError");
    expect(err.status).toBe(409);
    expect(err.code).toBe("conflict");
  });

  it("FlowpanelRateLimitError defaults to 429", () => {
    const err = new FlowpanelRateLimitError();
    expect(err.name).toBe("FlowpanelRateLimitError");
    expect(err.status).toBe(429);
    expect(err.code).toBe("rate_limited");
  });

  it("each subclass accepts a custom message", () => {
    expect(new FlowpanelAuthError("nope").message).toBe("nope");
    expect(new FlowpanelAccessError("forbidden!").message).toBe("forbidden!");
    expect(new FlowpanelNotFoundError("404 it").message).toBe("404 it");
    expect(new FlowpanelConflictError("dup").message).toBe("dup");
    expect(new FlowpanelRateLimitError("too fast").message).toBe("too fast");
  });
});
