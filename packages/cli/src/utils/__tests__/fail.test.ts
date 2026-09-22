import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messageChain, redactDiagnostic, reportFatal } from "../fail";

describe("messageChain", () => {
  it("walks every cause", () => {
    const root = new Error("ECONNREFUSED 127.0.0.1:5432");
    const wrapped = new Error("Failed query: CREATE TABLE IF NOT EXISTS x", { cause: root });
    expect(messageChain(wrapped)).toEqual([
      "Failed query: CREATE TABLE IF NOT EXISTS x",
      "ECONNREFUSED 127.0.0.1:5432",
    ]);
  });

  it("handles a thrown non-Error", () => {
    expect(messageChain("boom")).toEqual(["boom"]);
  });

  it("stops rather than looping on a self-referential cause", () => {
    const a = new Error("a");
    a.cause = a;
    expect(messageChain(a).length).toBeLessThanOrEqual(10);
  });
});

describe("reportFatal", () => {
  const out: string[] = [];
  const err: string[] = [];
  let previous: string | undefined;

  beforeEach(() => {
    out.length = 0;
    err.length = 0;
    previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      out.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      err.push(String(chunk));
      return true;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });

  it("recognises the driver error drizzle wraps in `Failed query:`", () => {
    reportFatal(
      new Error("Failed query: CREATE TABLE IF NOT EXISTS _flowpanel_migrations", {
        cause: new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      }),
    );
    expect(err.join("")).toContain("DATABASE_URL is not set");
    expect(out.join("")).toContain(".env");
  });

  it("still reports an unrelated failure verbatim", () => {
    reportFatal(new Error('relation "users" does not exist'));
    expect(err.join("")).toContain('relation "users" does not exist');
    expect(err.join("")).not.toContain("DATABASE_URL is not set");
  });

  it("shows a nested driver cause even when DATABASE_URL is already set, without URL credentials", () => {
    process.env.DATABASE_URL = "postgres://private:secret@db.example/test";
    reportFatal(
      new Error("Failed query: connection", {
        cause: new Error("ECONNREFUSED postgres://private:secret@db.example/test"),
      }),
    );
    const output = err.join("") + out.join("");
    expect(output).toContain("ECONNREFUSED");
    expect(output).not.toContain("private:secret");
    expect(output).not.toContain("DATABASE_URL is not set");
  });
});

describe("redactDiagnostic", () => {
  it("hides credentials embedded in a connection or registry URL", () => {
    expect(redactDiagnostic("connect postgres://admin:hunter2@db:5432/app")).toBe(
      "connect postgres://[redacted]@db:5432/app",
    );
    expect(redactDiagnostic("GET https://user:tok@registry.internal/pkg")).not.toContain("tok@");
  });

  it("hides a bare token the package manager printed outside a query string", () => {
    expect(redactDiagnostic("npm error _authToken=abcd1234 was rejected")).toBe(
      "npm error _authToken=[redacted] was rejected",
    );
    expect(redactDiagnostic('{"password": "hunter2"}')).not.toContain("hunter2");
    expect(redactDiagnostic("api_key: sk-live-1")).toBe("api_key: [redacted]");
  });

  it("still hides query-string and authorization-header forms", () => {
    expect(redactDiagnostic("https://host/x?access_token=abc&page=2")).toBe(
      "https://host/x?access_token=[redacted]&page=2",
    );
    expect(redactDiagnostic("authorization: Bearer abc.def")).toBe(
      "authorization: Bearer [redacted]",
    );
  });

  it("leaves diagnostics that carry no credential alone", () => {
    const message = "npm error 404 Not Found - GET https://registry.npmjs.org/@flowpanel%2fkit";
    expect(redactDiagnostic(message)).toBe(message);
    expect(redactDiagnostic("relation users does not exist")).toBe("relation users does not exist");
  });
});
