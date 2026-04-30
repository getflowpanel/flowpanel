import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectAuth, detectDbClient, detectSchema, detectStack } from "../detect.js";

describe("detect*", () => {
  let tmp: string;
  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-detect-"));
    await fs.writeFile(
      path.join(tmp, "package.json"),
      JSON.stringify({
        dependencies: {
          next: "^15.0.0",
          "drizzle-orm": "^0.30.0",
          tailwindcss: "^4.0.0",
        },
        devDependencies: { typescript: "^5.5.0" },
      }),
    );
    await fs.mkdir(path.join(tmp, "src/server/lib/db"), { recursive: true });
    await fs.writeFile(path.join(tmp, "src/server/lib/db.ts"), "export const db = {};");
    await fs.writeFile(path.join(tmp, "src/server/lib/db/schema.ts"), "export const users = {};");
    await fs.writeFile(
      path.join(tmp, "src/server/lib/auth.ts"),
      "export const getSession = () => null;",
    );
  });
  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("detectStack pulls Next, TS, Drizzle, Tailwind", async () => {
    const s = await detectStack(tmp);
    expect(s.nextjs).toBe("^15.0.0");
    expect(s.nextjsMajor).toBe(15);
    expect(s.typescript).toBe(true);
    expect(s.drizzle).toBe(true);
    expect(s.prisma).toBe(false);
    expect(s.tailwind).toBe(true);
    expect(s.tailwindMajor).toBe(4);
  });

  it("detectDbClient returns @/ path when src/server/lib/db.ts exists", async () => {
    expect(await detectDbClient(tmp)).toBe("@/server/lib/db");
  });
  it("detectSchema returns @/ path", async () => {
    expect(await detectSchema(tmp)).toBe("@/server/lib/db/schema");
  });
  it("detectAuth returns @/ path", async () => {
    expect(await detectAuth(tmp)).toBe("@/server/lib/auth");
  });

  it("returns null when no match", async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), "fp-empty-"));
    try {
      expect(await detectDbClient(empty)).toBeNull();
      expect(await detectSchema(empty)).toBeNull();
      expect(await detectAuth(empty)).toBeNull();
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});
