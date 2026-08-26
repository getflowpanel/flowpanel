import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messageChain, reportFatal } from "../fail";

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
});
