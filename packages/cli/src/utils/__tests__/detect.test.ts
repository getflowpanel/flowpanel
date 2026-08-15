import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  aliasOf,
  configImportFor,
  detectAppDir,
  detectAuth,
  detectDbClient,
  detectPackageManager,
  detectPathAlias,
  detectSchema,
  detectStack,
  platformBin,
  pmCommands,
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
  it("finds src/db/client.ts (ai-scraper layout)", async () => {
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

  it("finds lib/prisma.ts (canonical Prisma layout)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-prisma-root-"));
    try {
      await fs.mkdir(path.join(tmp, "lib"), { recursive: true });
      await fs.writeFile(path.join(tmp, "lib/prisma.ts"), "export const prisma = {};");
      await fs.writeFile(
        path.join(tmp, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
      );
      expect(await detectDbClient(tmp)).toBe("@/lib/prisma");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("finds src/lib/prisma.ts (Prisma under src/)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-prisma-src-"));
    try {
      await fs.mkdir(path.join(tmp, "src/lib"), { recursive: true });
      await fs.writeFile(path.join(tmp, "src/lib/prisma.ts"), "export const prisma = {};");
      await fs.writeFile(
        path.join(tmp, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } }),
      );
      expect(await detectDbClient(tmp)).toBe("@/lib/prisma");
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

  it("returns 'root' for paths['@/*'] = ['./*'] (ai-scraper layout)", async () => {
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

describe("detectPackageManager", () => {
  const origUA = process.env.npm_config_user_agent;
  beforeEach(() => {
    delete process.env.npm_config_user_agent;
  });
  afterEach(() => {
    if (origUA === undefined) delete process.env.npm_config_user_agent;
    else process.env.npm_config_user_agent = origUA;
  });

  it("prefers npm_config_user_agent over any lockfile", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-pm-"));
    try {
      // A yarn.lock on disk must not override the agent that actually invoked us.
      await fs.writeFile(path.join(tmp, "yarn.lock"), "");
      process.env.npm_config_user_agent = "pnpm/8.15.0 npm/? node/v20";
      expect(await detectPackageManager(tmp)).toBe("pnpm");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("falls back to the lockfile in cwd", async () => {
    const cases: [string, string][] = [
      ["pnpm-lock.yaml", "pnpm"],
      ["yarn.lock", "yarn"],
      ["bun.lockb", "bun"],
      ["package-lock.json", "npm"],
    ];
    for (const [lockfile, expected] of cases) {
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-pm-"));
      try {
        await fs.writeFile(path.join(tmp, lockfile), "");
        expect(await detectPackageManager(tmp)).toBe(expected);
      } finally {
        await fs.rm(tmp, { recursive: true, force: true });
      }
    }
  });

  it("defaults to npm when nothing is detectable", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-pm-"));
    try {
      expect(await detectPackageManager(tmp)).toBe("npm");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("pmCommands", () => {
  it("maps dev/prod add argv per manager", () => {
    expect(pmCommands("pnpm").add("@flowpanel/cli", true)).toEqual(["add", "-D", "@flowpanel/cli"]);
    expect(pmCommands("npm").add("@flowpanel/cli", true)).toEqual([
      "install",
      "--save-dev",
      "@flowpanel/cli",
    ]);
    expect(pmCommands("npm").add("@flowpanel/kit", false)).toEqual([
      "install",
      "--save",
      "@flowpanel/kit",
    ]);
    expect(pmCommands("yarn").add("@flowpanel/kit", false)).toEqual(["add", "@flowpanel/kit"]);
    expect(pmCommands("bun").add("@flowpanel/cli", true)).toEqual(["add", "-d", "@flowpanel/cli"]);
  });

  it("maps exec/run to each manager's dialect", () => {
    expect(pmCommands("pnpm")).toMatchObject({ exec: "pnpm", run: "pnpm" });
    expect(pmCommands("npm")).toMatchObject({ exec: "npx", run: "npm run" });
    expect(pmCommands("yarn")).toMatchObject({ exec: "yarn", run: "yarn" });
    expect(pmCommands("bun")).toMatchObject({ exec: "bunx", run: "bun run" });
  });

  it("builds argv for a project-local binary per manager", () => {
    const args = ["dev", "--port", "3000"];
    expect(pmCommands("pnpm").execArgs("next", args)).toEqual([
      "exec",
      "next",
      "dev",
      "--port",
      "3000",
    ]);
    expect(pmCommands("npm").execArgs("next", args)).toEqual(["next", "dev", "--port", "3000"]);
    expect(pmCommands("yarn").execArgs("next", args)).toEqual(["next", "dev", "--port", "3000"]);
    expect(pmCommands("bun").execArgs("next", args)).toEqual(["next", "dev", "--port", "3000"]);
  });
});

describe("platformBin", () => {
  it("returns the bare name off Windows and the .cmd shim on it", () => {
    const expected = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    expect(platformBin("pnpm")).toBe(expected);
  });
});

describe("detectAppDir", () => {
  it("returns 'app' when app/ exists at the root", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-appdir-root-"));
    try {
      await fs.mkdir(path.join(tmp, "app"), { recursive: true });
      expect(await detectAppDir(tmp)).toBe("app");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("returns 'src/app' when only src/app/ exists", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-appdir-src-"));
    try {
      await fs.mkdir(path.join(tmp, "src", "app"), { recursive: true });
      expect(await detectAppDir(tmp)).toBe("src/app");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("prefers root app/ over src/app/ when both exist", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-appdir-both-"));
    try {
      await fs.mkdir(path.join(tmp, "app"), { recursive: true });
      await fs.mkdir(path.join(tmp, "src", "app"), { recursive: true });
      expect(await detectAppDir(tmp)).toBe("app");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("defaults to 'app' when neither exists", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-appdir-none-"));
    try {
      expect(await detectAppDir(tmp)).toBe("app");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("configImportFor", () => {
  it("uses the @/ alias when mode is 'root' (alias maps straight to repo root)", () => {
    expect(configImportFor("app/api/flowpanel/[...route]", "root")).toBe("@/flowpanel.config");
    expect(configImportFor("src/app/admin/[[...slug]]", "root")).toBe("@/flowpanel.config");
  });

  it("falls back to a relative path when mode is 'strip-src' (@/* → src/*, config is at the repo root)", () => {
    expect(configImportFor("app/api/flowpanel/[...route]", "strip-src")).toBe(
      "../../../../flowpanel.config",
    );
    expect(configImportFor("app/admin/[[...slug]]", "strip-src")).toBe("../../../flowpanel.config");
  });

  it("falls back to a relative path when mode is 'none'", () => {
    expect(configImportFor("app/api/flowpanel/[...route]", "none")).toBe(
      "../../../../flowpanel.config",
    );
  });

  it("computes the correct depth for src/app routes", () => {
    expect(configImportFor("src/app/api/flowpanel/[...route]", "none")).toBe(
      "../../../../../flowpanel.config",
    );
    expect(configImportFor("src/app/api/flowpanel/stream", "none")).toBe(
      "../../../../../flowpanel.config",
    );
    expect(configImportFor("src/app/admin/[[...slug]]", "none")).toBe(
      "../../../../flowpanel.config",
    );
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
