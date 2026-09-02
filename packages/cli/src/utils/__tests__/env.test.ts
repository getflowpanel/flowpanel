import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDotEnv } from "../env";

let dir: string;
const saved = { ...process.env };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-env-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

const write = (name: string, body: string) => fs.writeFileSync(path.join(dir, name), body);

describe("loadDotEnv", () => {
  it("reads DATABASE_URL out of .env", () => {
    write(".env", "DATABASE_URL=postgres://from-env/db\n");
    loadDotEnv(dir);
    expect(process.env.DATABASE_URL).toBe("postgres://from-env/db");
  });

  it("lets .env.local win over .env", () => {
    write(".env", "DATABASE_URL=postgres://base/db\n");
    write(".env.local", "DATABASE_URL=postgres://local/db\n");
    loadDotEnv(dir);
    expect(process.env.DATABASE_URL).toBe("postgres://local/db");
  });

  it("never overrides a variable already set in the shell", () => {
    process.env.DATABASE_URL = "postgres://shell/db";
    write(".env", "DATABASE_URL=postgres://file/db\n");
    loadDotEnv(dir);
    expect(process.env.DATABASE_URL).toBe("postgres://shell/db");
  });

  it("is a no-op when no env file exists", () => {
    expect(() => loadDotEnv(dir)).not.toThrow();
  });

  it("falls back to its own parser when process.loadEnvFile is unavailable (Node < 20.12)", () => {
    const native = process.loadEnvFile;
    // @ts-expect-error — simulating an older Node that lacks the built-in.
    process.loadEnvFile = undefined;
    try {
      write(".env", "DATABASE_URL=postgres://parsed/db\n");
      loadDotEnv(dir);
      expect(process.env.DATABASE_URL).toBe("postgres://parsed/db");
    } finally {
      process.loadEnvFile = native;
    }
  });

  it("handles quotes, comments, blank lines and an export prefix", () => {
    write(".env", "\n# a comment\nexport QUOTED=\"spaced value\"\nSINGLE='x=y'\nBARE=plain\n");
    loadDotEnv(dir);
    expect(process.env.QUOTED).toBe("spaced value");
    expect(process.env.SINGLE).toBe("x=y");
    expect(process.env.BARE).toBe("plain");
  });
});
