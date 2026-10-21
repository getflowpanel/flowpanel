import { describe, expect, it } from "vitest";
import { connectionEnvNames } from "../db-env";

describe("connectionEnvNames", () => {
  it("finds the connection variables a client module reads, in every common spelling", () => {
    expect(
      connectionEnvNames(
        [
          "drizzle(process.env.DATABASE_URL!);",
          'new Pool({ connectionString: process.env["POSTGRES_URL"] });',
          "createClient({ url: env.TURSO_DATABASE_URL });",
          'url = env("DIRECT_URL")',
          "ssl: process.env.DATABASE_SSL === 'true'",
        ].join("\n"),
      ),
    ).toEqual(["DATABASE_URL", "POSTGRES_URL", "TURSO_DATABASE_URL", "DIRECT_URL"]);
  });

  it("skips names with a literal fallback and names that are not the database", () => {
    expect(
      connectionEnvNames(
        [
          'drizzle(process.env.DATABASE_URL ?? "file:local.db");',
          "const redis = process.env.REDIS_URL;",
          "const kv = process.env.KV_REST_API_URL;",
          "const site = process.env.NEXT_PUBLIC_APP_URL;",
          "const auth = process.env.BETTER_AUTH_URL;",
          'const replica = process.env.REPLICA_URL || "";',
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("keeps both names of a chain that falls back to another variable", () => {
    expect(
      connectionEnvNames(
        "new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });",
      ),
    ).toEqual(["DATABASE_URL", "POSTGRES_URL"]);
  });

  it("still asks for a variable whose fallback is init's never-resolving .invalid host", () => {
    expect(
      connectionEnvNames(
        'const connectionString = process.env.DATABASE_URL || "postgresql://DATABASE_URL-is-not-set.invalid./db";',
      ),
    ).toEqual(["DATABASE_URL"]);
  });
});
