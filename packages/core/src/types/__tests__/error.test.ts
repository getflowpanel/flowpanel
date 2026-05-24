import { describe, expect, it } from "vitest";
import {
  FlowpanelAccessError,
  FlowpanelAuthError,
  FlowpanelConflictError,
  FlowpanelError,
  FlowpanelNotFoundError,
  FlowpanelRateLimitError,
  FlowpanelValidationError,
} from "../error.js";

describe("FlowpanelError", () => {
  it("carries code, safeMessage, and status; defaults status to 500", () => {
    const err = new FlowpanelError("internal", "Something broke");
    expect(err.name).toBe("FlowpanelError");
    expect(err.code).toBe("internal");
    expect(err.safeMessage).toBe("Something broke");
    expect(err.status).toBe(500);
    expect(err.message).toBe("Something broke");
  });

  it("accepts a custom status", () => {
    const err = new FlowpanelError("teapot", "I am a teapot", 418);
    expect(err.status).toBe(418);
  });

  it("toJSON exposes code + message (not the stack)", () => {
    const err = new FlowpanelError("x", "oops");
    expect(err.toJSON()).toEqual({ code: "x", message: "oops" });
  });
});

describe("Specialized error subclasses", () => {
  it("FlowpanelValidationError defaults message + status=400 and carries fieldErrors", () => {
    const err = new FlowpanelValidationError({ email: "invalid" });
    expect(err.name).toBe("FlowpanelValidationError");
    expect(err.code).toBe("validation");
    expect(err.status).toBe(400);
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
    expect(err.code).toBe("auth");
  });

  it("FlowpanelAccessError defaults to 403", () => {
    const err = new FlowpanelAccessError();
    expect(err.name).toBe("FlowpanelAccessError");
    expect(err.status).toBe(403);
    expect(err.code).toBe("access");
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
    expect(err.code).toBe("rate_limit");
  });

  it("each subclass accepts a custom message", () => {
    expect(new FlowpanelAuthError("nope").message).toBe("nope");
    expect(new FlowpanelAccessError("forbidden!").message).toBe("forbidden!");
    expect(new FlowpanelNotFoundError("404 it").message).toBe("404 it");
    expect(new FlowpanelConflictError("dup").message).toBe("dup");
    expect(new FlowpanelRateLimitError("too fast").message).toBe("too fast");
  });
});
