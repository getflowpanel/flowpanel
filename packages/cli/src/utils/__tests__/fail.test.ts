import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectionFailure, messageChain, redactDiagnostic, reportFatal } from "../fail";

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

describe("reportFatal on an unreachable database", () => {
  const out: string[] = [];
  const err: string[] = [];
  const saved = { url: process.env.DATABASE_URL, debug: process.env.FLOWPANEL_DEBUG };

  function refused(address: string, port: number): Error {
    return Object.assign(new Error(`connect ECONNREFUSED ${address}:${port}`), {
      code: "ECONNREFUSED",
      address,
      port,
    });
  }

  function drizzleFailure(cause: Error): Error {
    return new Error(
      "Failed query: CREATE TABLE IF NOT EXISTS _flowpanel_migrations (\n  id text PRIMARY KEY\n)\nparams: ",
      { cause },
    );
  }

  beforeEach(() => {
    out.length = 0;
    err.length = 0;
    process.env.DATABASE_URL = "postgres://admin:hunter2@db.internal:6543/app";
    delete process.env.FLOWPANEL_DEBUG;
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
    for (const [key, value] of [
      ["DATABASE_URL", saved.url],
      ["FLOWPANEL_DEBUG", saved.debug],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("leads with the host, the port and the code, and hides the failed SQL", () => {
    reportFatal(drizzleFailure(refused("127.0.0.1", 1)));
    const lines = err.join("").split("\n");
    expect(lines[0]).toContain(
      "Cannot reach the database at 127.0.0.1:1 (ECONNREFUSED). Check DATABASE_URL.",
    );
    expect(err.join("")).not.toContain("Failed query");
    expect(err.join("")).not.toContain("CREATE TABLE");
    expect(out.join("")).toContain("FLOWPANEL_DEBUG=1");
  });

  it("shows the failed SQL and the causes under FLOWPANEL_DEBUG=1", () => {
    process.env.FLOWPANEL_DEBUG = "1";
    reportFatal(drizzleFailure(refused("127.0.0.1", 1)));
    expect(err.join("").split("\n")[0]).toContain("Cannot reach the database at 127.0.0.1:1");
    expect(err.join("")).toContain("Failed query: CREATE TABLE IF NOT EXISTS");
    expect(err.join("")).toContain("connect ECONNREFUSED 127.0.0.1:1");
  });

  it("reads the endpoint from an aggregate error and brackets an IPv6 address", () => {
    const aggregate = Object.assign(
      new AggregateError([refused("::1", 5432), refused("127.0.0.1", 5432)]),
      {
        code: "ECONNREFUSED",
      },
    );
    reportFatal(drizzleFailure(aggregate));
    expect(err.join("")).toContain("at [::1]:5432 (ECONNREFUSED)");
  });

  it("names a host that does not resolve", () => {
    const missing = Object.assign(new Error("getaddrinfo ENOTFOUND db.example.test"), {
      code: "ENOTFOUND",
      hostname: "db.example.test",
    });
    reportFatal(missing);
    expect(err.join("")).toContain(
      "Cannot reach the database at db.example.test (ENOTFOUND). Check DATABASE_URL.",
    );
  });

  it("falls back to the host and port in DATABASE_URL, never its credentials", () => {
    reportFatal(drizzleFailure(new Error("connect ECONNREFUSED")));
    expect(err.join("")).toContain("at db.internal:6543 (ECONNREFUSED)");
    expect(err.join("") + out.join("")).not.toContain("hunter2");
    expect(err.join("") + out.join("")).not.toContain("admin");
  });

  function prismaFailure(
    errorCode: string,
    message: string,
    field: "errorCode" | "code" = "errorCode",
  ) {
    return Object.assign(new Error(message), { [field]: errorCode, clientVersion: "5.22.0" });
  }

  it("recognises Prisma's P1001 and takes the host and port from its message", () => {
    reportFatal(
      prismaFailure(
        "P1001",
        "Can't reach database server at `db.example.test:5432`\n\nPlease make sure your database server is running at `db.example.test:5432`.",
      ),
    );
    expect(err.join("").split("\n")[0]).toContain(
      "Cannot reach the database at db.example.test:5432 (P1001). Check DATABASE_URL.",
    );
    expect(err.join("")).not.toContain("Please make sure");
  });

  it("reads the older host-and-port form of the Prisma message", () => {
    reportFatal(prismaFailure("P1001", "Can't reach database server at `localhost`:`3306`"));
    expect(err.join("")).toContain("at localhost:3306 (P1001)");
  });

  it("recognises P1002 and P1017, and P1001 on a request error's code", () => {
    reportFatal(
      prismaFailure("P1002", "The database server at `10.0.0.5`:`5432` was reached but timed out."),
    );
    expect(err.join("")).toContain("at 10.0.0.5:5432 (P1002)");
    err.length = 0;
    reportFatal(prismaFailure("P1017", "Server has closed the connection."));
    expect(err.join("")).toContain("at db.internal:6543 (P1017)");
    err.length = 0;
    reportFatal(prismaFailure("P1001", "Can't reach database server at `h:1`", "code"));
    expect(err.join("")).toContain("at h:1 (P1001)");
  });

  it("never prints credentials that appear in a Prisma message", () => {
    reportFatal(
      prismaFailure("P1001", "Can't reach database server at `admin:hunter2@db.example.test:5432`"),
    );
    expect(err.join("") + out.join("")).not.toContain("hunter2");
    expect(err.join("") + out.join("")).not.toContain("admin");
    expect(err.join("")).toContain("at db.example.test:5432 (P1001)");
  });

  it("does not report a URL scheme as the endpoint", () => {
    reportFatal(new Error("connect ECONNREFUSED postgres://u:p@h:5432/db"));
    expect(err.join("")).toContain("at db.internal:6543 (ECONNREFUSED)");
    expect(err.join("")).not.toContain("at postgres");
  });

  function serverError(code: string, message: string): Error {
    return drizzleFailure(Object.assign(new Error(message), { code }));
  }

  it("names a refused login without printing the failed SQL", () => {
    for (const code of ["28P01", "28000"]) {
      err.length = 0;
      reportFatal(serverError(code, 'password authentication failed for user "admin"'));
      expect(err.join("").split("\n")[0]).toContain(
        `The database at db.internal:6543 refused the login (${code}). Check the user and password in DATABASE_URL.`,
      );
      expect(err.join("")).not.toContain("Failed query");
      expect(err.join("")).not.toContain("hunter2");
    }
  });

  it("names a database that does not exist, and an unreachable server for 08001", () => {
    reportFatal(serverError("3D000", 'database "app" does not exist'));
    expect(err.join("").split("\n")[0]).toContain(
      "The database server at db.internal:6543 has no database by the name in DATABASE_URL (3D000).",
    );
    err.length = 0;
    reportFatal(serverError("08001", "could not establish connection"));
    expect(err.join("").split("\n")[0]).toContain(
      "Cannot reach the database at db.internal:6543 (08001). Check DATABASE_URL.",
    );
    expect(err.join("")).not.toContain("CREATE TABLE");
  });

  it("shows the SQL behind a refused login under FLOWPANEL_DEBUG=1", () => {
    process.env.FLOWPANEL_DEBUG = "1";
    reportFatal(serverError("28P01", "password authentication failed"));
    expect(err.join("")).toContain("Failed query: CREATE TABLE IF NOT EXISTS");
  });

  it("does not treat an unrelated failure as a connection problem", () => {
    reportFatal(new Error('relation "users" does not exist'));
    expect(err.join("")).toContain('relation "users" does not exist');
    expect(err.join("")).not.toContain("Cannot reach");
  });
});

describe("connectionFailure", () => {
  it("answers null when nothing in the chain is a connection error", () => {
    expect(connectionFailure(new Error("boom", { cause: new Error("inner") }))).toBeNull();
  });

  it("finds the code in a message that carries no code property", () => {
    expect(connectionFailure(new Error("connect ETIMEDOUT 10.0.0.5:5432"))).toEqual({
      code: "ETIMEDOUT",
      endpoint: "10.0.0.5:5432",
    });
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
