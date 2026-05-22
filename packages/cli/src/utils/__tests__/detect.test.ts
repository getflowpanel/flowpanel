import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  aliasOf,
  detectAuth,
  detectDbClient,
  detectPathAlias,
  detectSchema,
  detectStack,
} from "../detect.js";

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
    await fs.writeFile(
      path.join(tmp, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } }),
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

describe("detectDbClient — new candidate paths", () => {
  it("finds src/db/client.ts (freelance-radar layout)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-dbclient-"));
    try {
      await fs.mkdir(path.join(tmp, "src/db"), { recursive: true });
      await fs.writeFile(path.join(tmp, "src/db/client.ts"), "export const db = {};");
      // No tsconfig → mode `none` → relative fallback
      expect(await detectDbClient(tmp)).toBe("./src/db/client");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("finds db/client.ts at project root", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-dbroot-"));
    try {
      await fs.mkdir(path.join(tmp, "db"), { recursive: true });
      await fs.writeFile(path.join(tmp, "db/client.ts"), "export const db = {};");
      expect(await detectDbClient(tmp)).toBe("./db/client");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("detectPathAlias", () => {
  it("returns 'strip-src' for paths['@/*'] = ['src/*']", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-alias-src-"));
    try {
      await fs.writeFile(
        path.join(tmp, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } }),
      );
      expect(await detectPathAlias(tmp)).toBe("strip-src");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns 'strip-src' for paths['@/*'] = ['./src/*']", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-alias-dotsrc-"));
    try {
      await fs.writeFile(
        path.join(tmp, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
      );
      expect(await detectPathAlias(tmp)).toBe("strip-src");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns 'root' for paths['@/*'] = ['./*'] (freelance-radar layout)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-alias-root-"));
    try {
      await fs.writeFile(
        path.join(tmp, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
      );
      expect(await detectPathAlias(tmp)).toBe("root");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns 'none' when no @/* alias is configured", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-alias-none-"));
    try {
      await fs.writeFile(path.join(tmp, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));
      expect(await detectPathAlias(tmp)).toBe("none");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns 'none' when tsconfig is missing", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-alias-missing-"));
    try {
      expect(await detectPathAlias(tmp)).toBe("none");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("tolerates // comments and trailing commas in tsconfig", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-alias-jsonc-"));
    try {
      await fs.writeFile(
        path.join(tmp, "tsconfig.json"),
        `{
          // Next.js scaffold style
          "compilerOptions": {
            "paths": { "@/*": ["src/*"], },
          },
        }`,
      );
      expect(await detectPathAlias(tmp)).toBe("strip-src");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("aliasOf", () => {
  it("strip-src: src/db/client.ts → @/db/client", () => {
    expect(aliasOf("src/db/client.ts", "strip-src")).toBe("@/db/client");
  });
  it("root: src/db/client.ts → @/src/db/client", () => {
    expect(aliasOf("src/db/client.ts", "root")).toBe("@/src/db/client");
  });
  it("none: src/db/client.ts → ./src/db/client", () => {
    expect(aliasOf("src/db/client.ts", "none")).toBe("./src/db/client");
  });
  it("strips .ts and .tsx extensions", () => {
    expect(aliasOf("src/db/client.tsx", "strip-src")).toBe("@/db/client");
  });
});

describe("detectDbClient honors alias mode", () => {
  it("with root-mode tsconfig, src/db/client.ts → @/src/db/client", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-aliasmode-"));
    try {
      await fs.mkdir(path.join(tmp, "src/db"), { recursive: true });
      await fs.writeFile(path.join(tmp, "src/db/client.ts"), "export const db = {};");
      await fs.writeFile(
        path.join(tmp, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
      );
      expect(await detectDbClient(tmp)).toBe("@/src/db/client");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
