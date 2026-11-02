import { afterEach, describe, expect, it, vi } from "vitest";
import { logCaught, plainAggregates } from "../runtime/caught-error";
import { isConnectionError } from "../runtime/connection-error";

function refused() {
  const failure = Object.assign(
    new AggregateError(
      [Object.assign(new Error("connect ECONNREFUSED ::1:5432"), { code: "ECONNREFUSED" })],
      "",
    ),
    { code: "ECONNREFUSED" },
  );
  return { failure, error: new Error("Failed query: select 1", { cause: failure }) };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("an error a render caught", () => {
  it("leaves no AggregateError for the dev renderer, but keeps its name, errors and code", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { failure, error } = refused();
    plainAggregates(error);
    expect(failure).not.toBeInstanceOf(AggregateError);
    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe("AggregateError");
    expect(failure.errors).toHaveLength(1);
    expect(isConnectionError(error)).toBe(true);
  });

  it("is left alone in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { failure, error } = refused();
    plainAggregates(error);
    expect(failure).toBeInstanceOf(AggregateError);
  });

  it("is logged as one bounded string in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { error } = refused();
    logCaught("[flowpanel] users: list failed", error);
    const args = log.mock.calls[0] ?? [];
    expect(args.every((arg) => typeof arg === "string")).toBe(true);
    expect(args[1]).toContain("AggregateError [ECONNREFUSED]");
    expect(args[1]).toContain("connect ECONNREFUSED ::1:5432");
  });

  it("is logged as the flattened object in development, so Next source-maps its stack", () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { failure, error } = refused();
    logCaught("[flowpanel] users: list failed", error);
    expect(log.mock.calls[0]?.[1]).toBe(error);
    expect(failure).not.toBeInstanceOf(AggregateError);
  });

  it("leaves a frozen AggregateError alone instead of throwing", () => {
    vi.stubEnv("NODE_ENV", "development");
    const frozen = Object.freeze(new AggregateError([], "frozen"));
    expect(() => plainAggregates(new Error("outer", { cause: frozen }))).not.toThrow();
  });
});
