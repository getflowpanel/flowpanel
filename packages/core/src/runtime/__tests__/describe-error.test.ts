import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, loggableError } from "../describe-error";

function refused(): Error {
  const failure = new AggregateError(
    [
      Object.assign(new Error("connect ECONNREFUSED ::1:54359"), { code: "ECONNREFUSED" }),
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:54359"), { code: "ECONNREFUSED" }),
    ],
    "",
  );
  Object.assign(failure, { code: "ECONNREFUSED" });
  return new Error("Failed query: select 1\nparams: secret@example.com", { cause: failure });
}

afterEach(() => vi.unstubAllEnvs());

describe("describeError", () => {
  it("names a pg AggregateError's code and every address it tried, first lines only", () => {
    const text = describeError(refused());
    expect(text).toContain("Error: Failed query: select 1");
    expect(text).not.toContain("secret@example.com");
    expect(text).not.toMatch(/\n\s+at /);
    expect(text).toContain("caused by: AggregateError [ECONNREFUSED]");
    expect(text).toContain("caused by: Error [ECONNREFUSED]: connect ECONNREFUSED ::1:54359");
    expect(text).toContain("connect ECONNREFUSED 127.0.0.1:54359");
  });

  it("logs the object in development, where Next source-maps it, and the string in production", () => {
    const error = refused();
    vi.stubEnv("NODE_ENV", "development");
    expect(loggableError(error)).toBe(error);
    vi.stubEnv("NODE_ENV", "production");
    expect(loggableError(error)).toBe(describeError(error));
  });

  it("stops at a cycle and after eight errors", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    Object.assign(a, { cause: b });
    expect(describeError(a).split("caused by").length).toBe(2);
    const many = new AggregateError(
      Array.from({ length: 20 }, (_, i) => new Error(`e${i}`)),
      "many",
    );
    expect(describeError(many).split("caused by").length).toBe(8);
  });

  it("reads past the blank line a Prisma message starts with, to what failed", () => {
    const prisma = Object.assign(
      new Error(
        "\nInvalid `prisma.user.findFirst()` invocation:\n\n\nCan't reach database server at `127.0.0.1:54374`\n\nPlease make sure your database server is running at `127.0.0.1:54374`.",
      ),
      { name: "PrismaClientInitializationError" },
    );
    expect(describeError(prisma)).toBe(
      "PrismaClientInitializationError: Invalid `prisma.user.findFirst()` invocation: Can't reach database server at `127.0.0.1:54374`",
    );
    expect(describeError(new Error("\n\nEnvironment variable not found: DATABASE_URL."))).toBe(
      "Error: Environment variable not found: DATABASE_URL.",
    );
  });

  it("describes a thrown value that is not an Error", () => {
    expect(describeError("boom").split("\n")[0]).toBe("boom");
    expect(describeError(`first\nsecret@example.com${"x".repeat(900)}`)).toBe("first");
    expect(describeError("y".repeat(900))).toHaveLength(500);
    expect(describeError(null).split("\n")[0]).toBe("null");
    expect(describeError({ message: "plain", code: 7 }).split("\n")[0]).toBe("Error [7]: plain");
  });
});
