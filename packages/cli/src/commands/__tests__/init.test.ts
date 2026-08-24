import { describe, expect, it } from "vitest";
import { tpl } from "../../utils/template.js";
import { guessedPaths, patchLayoutWithSuppressHydration } from "../init.js";

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

describe("init templates (resolution)", () => {
  it("substitutes DB/SCHEMA/AUTH/APP_NAME into config template", async () => {
    const out = await tpl("flowpanel.config.drizzle.ts.txt", {
      DB: "@/server/db",
      SCHEMA: "@/server/schema",
      AUTH: "@/server/auth",
      APP_NAME: "Acme",
    });
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
    expect(out).toContain('runtime = "nodejs"');
  });

  it("sse-route template substitutes CONFIG_IMPORT", async () => {
    const out = await tpl("sse-route.ts.txt", { CONFIG_IMPORT: "@/flowpanel.config" });
    expect(out).toContain('import config from "@/flowpanel.config"');
    expect(out).toContain("export const GET = stream(config)");
    expect(out).toContain('dynamic = "force-dynamic"');
  });

  it("admin-page template substitutes CONFIG_IMPORT", async () => {
    const out = await tpl("admin-page.tsx.txt", { CONFIG_IMPORT: "../../../flowpanel.config" });
    expect(out).toContain('from "@flowpanel/kit/next"');
    expect(out).toContain('import config from "../../../flowpanel.config"');
    expect(out).toContain("export default flowpanel.page");
  });

  it("app-layout template substitutes APP_NAME + CSS_IMPORT", async () => {
    const out = await tpl("app-layout.tsx.txt", {
      APP_NAME: "Acme",
      CSS_IMPORT: "@/styles/admin.css",
    });
    expect(out).toContain('import "@/styles/admin.css";');
    expect(out).toContain('title: "Acme — Admin"');
    expect(out).toContain('<html lang="en" suppressHydrationWarning>');
  });

  it("tailwind v3 config template exposes the fp-* color map", async () => {
    const out = await tpl("tailwind.config.v3.ts.txt");
    expect(out).toContain('"fp-bg-1"');
    expect(out).toContain('"fp-text-1"');
    expect(out).toContain('"fp-accent"');
    expect(out).toContain("borderRadius:");
    expect(out).toContain('fp: "var(--fp-radius)"');
  });

  it("admin.css.v3 template omits @theme (v4 syntax) and includes v3 directives", async () => {
    const out = await tpl("admin.css.v3.txt");
    expect(out).toContain("@tailwind base;");
    expect(out).toContain("@tailwind components;");
    expect(out).toContain("@tailwind utilities;");
    // The v3 sheet must not contain the v4 `@theme {}` directive at the
    // start of a line. (A `@theme` mention in a comment is fine.)
    expect(out).not.toMatch(/^@theme\b/m);
    expect(out).toContain("--fp-bg-1");
    expect(out).toContain("--fp-radius:");
  });

  it("admin.css (v4) invokes Tailwind and scans the @flowpanel packages at the styles/ depth", async () => {
    // styles/admin.css → app root is one level up.
    const out = await tpl("admin.css.txt", { SOURCE_UP: "../" });
    expect(out).toContain('@import "tailwindcss";');
    expect(out).toContain('@source "../node_modules/@flowpanel/*/dist";');
    expect(out).toContain('@source "../node_modules/.pnpm/node_modules/@flowpanel/*/dist";');
  });

  it("admin.css (v4) @source depth adjusts for the src/styles/ scaffold layout", async () => {
    // src/styles/admin.css (strip-src aliasMode) → app root is two levels up.
    const out = await tpl("admin.css.txt", { SOURCE_UP: "../../" });
    expect(out).toContain('@source "../../node_modules/@flowpanel/*/dist";');
    expect(out).toContain('@source "../../node_modules/.pnpm/node_modules/@flowpanel/*/dist";');
  });

  it("tailwind v3 config template scans the @flowpanel packages' dist output", async () => {
    const out = await tpl("tailwind.config.v3.ts.txt");
    expect(out).toContain('"./node_modules/@flowpanel/*/dist/**/*.{js,mjs}"');
    expect(out).toContain('"./node_modules/.pnpm/node_modules/@flowpanel/*/dist/**/*.{js,mjs}"');
  });
});

describe("patchLayoutWithSuppressHydration", () => {
  it("adds the attribute to an <html> tag that has other props", () => {
    const out = patchLayoutWithSuppressHydration('<html lang="en">');
    expect(out).toBe('<html lang="en" suppressHydrationWarning>');
  });

  it("adds the attribute to a bare <html> tag", () => {
    expect(patchLayoutWithSuppressHydration("<html>")).toBe("<html suppressHydrationWarning>");
  });

  it("handles a multi-line <html> tag", () => {
    const src = '<html\n  lang="en"\n  className="x"\n>';
    expect(patchLayoutWithSuppressHydration(src)).toBe(
      '<html\n  lang="en"\n  className="x" suppressHydrationWarning\n>',
    );
  });

  it("returns null when the attribute is already there", () => {
    expect(
      patchLayoutWithSuppressHydration('<html lang="en" suppressHydrationWarning>'),
    ).toBeNull();
  });

  it("returns null when there is no <html> tag to patch", () => {
    expect(patchLayoutWithSuppressHydration("export default function L() {}")).toBeNull();
  });

  it("leaves an <htmlSomething> identifier alone", () => {
    expect(patchLayoutWithSuppressHydration("const htmlFoo = 1;")).toBeNull();
  });
});
