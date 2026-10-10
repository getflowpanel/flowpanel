import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { adminPageSource, isGeneratedAdminPage } from "../../utils/admin-page";
import { blockingSegmentExport } from "../../utils/next-config";
import { tpl } from "../../utils/template";
import { guessedAuthFile, guessedPaths } from "../init-detect";
import { configTemplateCall, renderCall } from "../init-templates";

describe("guessedPaths", () => {
  it("uses the @/ alias when the project has one", () => {
    expect(guessedPaths("drizzle", "strip-src")).toEqual({
      db: "@/server/lib/db",
      schema: "@/server/lib/db/schema",
      auth: "@/server/lib/auth",
    });
    expect(guessedPaths("drizzle", "root").db).toBe("@/server/lib/db");
  });

  it("guesses relative specifiers when the project has no @/ alias", () => {
    expect(guessedPaths("drizzle", "none")).toEqual({
      db: "./server/lib/db",
      schema: "./server/lib/db/schema",
      auth: "./server/lib/auth",
    });
  });

  it("points Prisma projects at the prisma client, alias or not", () => {
    expect(guessedPaths("prisma", "strip-src").db).toBe("@/lib/prisma");
    expect(guessedPaths("prisma", "none").db).toBe("./lib/prisma");
  });
});

describe("guessedAuthFile", () => {
  it("lands where the guessed auth specifier resolves", () => {
    // guessedPaths(...).auth is what flowpanel.config.ts imports; the scaffolded
    // stub has to be written to the file that specifier actually resolves to.
    expect(guessedPaths("drizzle", "strip-src").auth).toBe("@/server/lib/auth");
    expect(guessedAuthFile("strip-src")).toBe("src/server/lib/auth.ts");
    expect(guessedPaths("drizzle", "root").auth).toBe("@/server/lib/auth");
    expect(guessedAuthFile("root")).toBe("server/lib/auth.ts");
    expect(guessedPaths("drizzle", "none").auth).toBe("./server/lib/auth");
    expect(guessedAuthFile("none")).toBe("server/lib/auth.ts");
  });
});

describe("dev-session template", () => {
  it("exports the getSession the config imports", async () => {
    const out = await tpl("dev-session.ts.txt", { FILE: "src/server/lib/auth.ts" });
    expect(out).toContain("export async function getSession()");
  });

  it("returns a static session the config's role mapper reads as admin", async () => {
    const out = await tpl("dev-session.ts.txt", { FILE: "src/server/lib/auth.ts" });
    expect(out).toContain('role: "admin"');
  });

  it("says loudly that it must be replaced, naming its own file", async () => {
    const out = await tpl("dev-session.ts.txt", { FILE: "src/server/lib/auth.ts" });
    expect(out.split("\n")[0]).toMatch(/^\/\/ DEVELOPMENT STUB: /);
    expect(out).toMatch(/console\.warn\(/);
    expect(out).toContain("[flowpanel] src/server/lib/auth.ts: signs every request in as an admin");
    expect(out).not.toContain("{{");
  });

  it("warns once per process, not on every request or module instance", async () => {
    const source = await tpl("dev-session.ts.txt", { FILE: "auth.ts" });
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    Reflect.deleteProperty(globalThis, Symbol.for("flowpanel.devSessionWarned"));
    const warn = vi.fn();
    for (let instance = 0; instance < 2; instance++) {
      const loaded: { getSession?: () => Promise<{ user: { role: string } }> } = {};
      new Function("exports", "console", outputText)(loaded, { warn });
      for (let request = 0; request < 3; request++) await loaded.getSession?.();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("before deploying");
    Reflect.deleteProperty(globalThis, Symbol.for("flowpanel.devSessionWarned"));
  });

  it("refuses to run in production instead of signing everyone in as admin", async () => {
    const out = await tpl("dev-session.ts.txt", { FILE: "src/server/lib/auth.ts" });
    expect(out).toContain('process.env.NODE_ENV === "production"');
    expect(out).toMatch(/throw new Error\(/);
  });
});

describe("init templates (resolution)", () => {
  it("substitutes DB/SCHEMA/AUTH/APP_NAME into config template", async () => {
    const out = await renderCall(
      configTemplateCall({
        orm: "drizzle",
        preset: false,
        db: "@/server/db",
        schema: "@/server/schema",
        auth: "@/server/auth",
        appName: "Acme",
        adminPath: "/admin",
        apiPath: "/api/flowpanel",
        cli: "pnpm flowpanel",
        provider: "postgresql",
        session: "stub",
      }),
    );
    expect(out).toContain('import { db } from "@/server/db"');
    expect(out).toContain('import * as schema from "@/server/schema"');
    expect(out).toContain('import { getSession } from "@/server/auth"');
    expect(out).toContain('brand: { name: "Acme" }');
  });

  it("api-route template substitutes CONFIG_IMPORT", async () => {
    const out = await tpl("api-route.ts.txt", { CONFIG_IMPORT: "../../../../flowpanel.config" });
    expect(out).toContain('from "@flowpanel/kit/next"');
    expect(out).toContain('import config from "../../../../flowpanel.config"');
    expect(out).toContain(
      "export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = flowpanel.handlers",
    );
    expect(out).not.toContain("export const runtime");
  });

  it("sse-route template substitutes CONFIG_IMPORT", async () => {
    const out = await tpl("sse-route.ts.txt", { CONFIG_IMPORT: "@/flowpanel.config" });
    expect(out).toContain('import config from "@/flowpanel.config"');
    expect(out).toContain("export const GET = stream(config)");
    expect(out).not.toMatch(/export const (runtime|dynamic)/);
  });

  it("admin-page template substitutes CONFIG_IMPORT", async () => {
    const out = await tpl("admin-page.tsx.txt", {
      CONFIG_IMPORT: "../../../flowpanel.config",
      SEGMENT_CONFIG: "",
    });
    expect(out).toContain('from "@flowpanel/kit/next"');
    expect(out).toContain('import config from "../../../flowpanel.config"');
    expect(out).toContain("export default flowpanel.page");
  });

  it("admin-page template exports the metadata the runtime derives from the config", async () => {
    const out = await tpl("admin-page.tsx.txt", {
      CONFIG_IMPORT: "../../../flowpanel.config",
      SEGMENT_CONFIG: "",
    });
    expect(out).toContain("export const generateMetadata = flowpanel.metadata;");
  });

  it("lets the catch-all page read the request under cacheComponents and only there", async () => {
    const blocking = await adminPageSource("@/flowpanel.config", true);
    expect(blocking).toContain(
      "const flowpanel = createFlowpanel(config);\n\nexport const instant = false;\n\nexport const generateMetadata",
    );
    expect(await adminPageSource("@/flowpanel.config", false)).not.toContain("instant");
  });

  it("recognises every catch-all page an earlier init wrote, and nothing else", async () => {
    const current = await adminPageSource("@/flowpanel.config", true);
    const withoutInstant = await adminPageSource("@/flowpanel.config", false);
    const from03 = withoutInstant.replace(
      "export const generateMetadata = flowpanel.metadata;\n",
      "",
    );
    for (const page of [current, withoutInstant, from03]) {
      expect(await isGeneratedAdminPage(page, "@/flowpanel.config")).toBe(true);
    }
    expect(await isGeneratedAdminPage(current, "../flowpanel.config")).toBe(false);
    expect(await isGeneratedAdminPage(`${current}// mine\n`, "@/flowpanel.config")).toBe(false);
  });

  it("admin-not-found template hands the runtime's not-found page to Next", async () => {
    const out = await tpl("admin-not-found.tsx.txt", { CONFIG_IMPORT: "../../flowpanel.config" });
    expect(out).toBe(
      [
        'import { createFlowpanel } from "@flowpanel/kit/next";',
        'import config from "../../flowpanel.config";',
        "",
        "const flowpanel = createFlowpanel(config);",
        "",
        "export const metadata = flowpanel.notFoundMetadata;",
        "",
        "export default flowpanel.notFound;",
        "",
      ].join("\n"),
    );
  });

  it("app-layout template substitutes APP_NAME + CSS_IMPORT", async () => {
    const out = await tpl("app-layout.tsx.txt", {
      APP_NAME: "Acme",
      CSS_IMPORT: "@/styles/admin.css",
      SEGMENT_CONFIG: "",
    });
    expect(out).toContain('import "@/styles/admin.css";');
    expect(out).toContain('title: "Acme — Admin"');
    expect(out).toContain('<html lang="en" suppressHydrationWarning>');
    expect(out).toContain('import { ThemeScript } from "@flowpanel/kit/react"');
    expect(out).toContain('<ThemeScript defaultMode="auto" nonce={nonce ?? undefined} />');
  });

  it("app-layout passes the host's CSP nonce to the theme script from a server component", async () => {
    const out = await tpl("app-layout.tsx.txt", {
      APP_NAME: "Acme",
      CSS_IMPORT: "@/styles/admin.css",
      SEGMENT_CONFIG: "",
    });
    expect(out).toContain('import { headers } from "next/headers";');
    expect(out).toContain('const nonce = (await headers()).get("x-nonce");');
    expect(out).toContain("export default async function RootLayout");
    expect(out).not.toContain('"use client"');
  });

  it("admin-layout renders the theme script with the host's CSP nonce", async () => {
    const out = await tpl("admin-layout.tsx.txt", {
      CSS_IMPORT: "@/styles/admin.css",
      SEGMENT_CONFIG: "",
    });
    expect(out).toContain('import "@/styles/admin.css";');
    expect(out).toContain('import { ThemeScript } from "@flowpanel/kit/react";');
    expect(out).toContain('import { headers } from "next/headers";');
    expect(out).toContain('const nonce = (await headers()).get("x-nonce");');
    expect(out).toContain('<ThemeScript defaultMode="auto" nonce={nonce ?? undefined} />');
    expect(out).toContain("export default async function AdminLayout");
    expect(out).not.toContain("//");
  });

  it("lets the admin layouts read the request under cacheComponents and only there", async () => {
    for (const template of ["admin-layout.tsx.txt", "app-layout.tsx.txt"]) {
      const vars = { APP_NAME: "Acme", CSS_IMPORT: "@/styles/admin.css" };
      const blocking = await tpl(template, {
        ...vars,
        SEGMENT_CONFIG: blockingSegmentExport(true),
      });
      expect(blocking).toMatch(
        /\n\nexport const instant = false;\n\nexport default async function/,
      );
      const plain = await tpl(template, { ...vars, SEGMENT_CONFIG: blockingSegmentExport(false) });
      expect(plain).not.toContain("instant");
      expect(plain).toMatch(
        /";\n\n(?:export const metadata[\s\S]*?};\n\n)?export default async function/,
      );
    }
  });

  it("writes a compiler-free stylesheet import regardless of the host Tailwind version", async () => {
    for (const template of ["admin.css.txt"]) {
      const out = await tpl(template);
      expect(out).toContain('@import "@flowpanel/kit/styles/admin.css";');
      expect(out).not.toMatch(/^@(tailwind|source|theme)\b/m);
    }
  });
});
