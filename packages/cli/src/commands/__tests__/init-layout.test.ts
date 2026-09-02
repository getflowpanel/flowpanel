import { describe, expect, it } from "vitest";
import {
  hasAdminCssImport,
  patchLayoutWithCssImport,
  patchLayoutWithSuppressHydration,
  patchLayoutWithThemeScript,
} from "../init-layout";

describe("root layout stylesheet", () => {
  it("adds the admin stylesheet after a client directive", () => {
    const source = `"use client";\n\nexport default function Layout() { return <html />; }`;
    expect(patchLayoutWithCssImport(source, "@/styles/admin.css")).toMatch(
      /^"use client";\n\nimport "@\/styles\/admin\.css";/,
    );
  });

  it("recognizes an existing admin stylesheet", () => {
    const source = 'import "@/styles/admin.css";\n<html />';
    expect(hasAdminCssImport(source)).toBe(true);
    expect(patchLayoutWithCssImport(source, "@/styles/admin.css")).toBeNull();
  });

  it("does not add a second global stylesheet", () => {
    expect(patchLayoutWithCssImport('import "./globals.css";\n<html />', "x.css")).toBeNull();
  });
});

describe("root layout hydration", () => {
  it("adds the attribute to an html tag that has other props", () => {
    expect(patchLayoutWithSuppressHydration('<html lang="en">')).toBe(
      '<html lang="en" suppressHydrationWarning>',
    );
  });

  it("adds the attribute to a bare html tag", () => {
    expect(patchLayoutWithSuppressHydration("<html>")).toBe("<html suppressHydrationWarning>");
  });

  it("handles a multi-line html tag", () => {
    const source = '<html\n  lang="en"\n  className="x"\n>';
    expect(patchLayoutWithSuppressHydration(source)).toBe(
      '<html\n  lang="en"\n  className="x" suppressHydrationWarning\n>',
    );
  });

  it("does not mistake a greater-than sign inside an attribute for the tag boundary", () => {
    expect(patchLayoutWithSuppressHydration('<html data-marker="a>b" lang="en">')).toBe(
      '<html data-marker="a>b" lang="en" suppressHydrationWarning>',
    );
  });

  it("leaves an already patched or missing html tag alone", () => {
    expect(
      patchLayoutWithSuppressHydration('<html lang="en" suppressHydrationWarning>'),
    ).toBeNull();
    expect(patchLayoutWithSuppressHydration("export default function Layout() {}")).toBeNull();
    expect(patchLayoutWithSuppressHydration("const htmlFoo = 1;")).toBeNull();
  });
});

describe("root layout theme script", () => {
  it("adds the import and a head to a standard root layout", () => {
    const source = `import type { Metadata } from "next";\n\nexport default function Layout() {\n  return (\n    <html lang="en">\n      <body />\n    </html>\n  );\n}\n`;
    const result = patchLayoutWithThemeScript(source);

    expect(result).toContain('import { ThemeScript } from "@flowpanel/kit/react";');
    expect(result).toContain('<head>\n        <ThemeScript defaultMode="auto" />\n      </head>');
  });

  it("reuses an existing head instead of creating a second one", () => {
    const result = patchLayoutWithThemeScript(
      `<html lang="en">\n  <head><meta charSet="utf-8" /></head>\n  <body />\n</html>`,
    );

    expect(result?.match(/<head/g)).toHaveLength(1);
    expect(result).toContain('<head>\n    <ThemeScript defaultMode="auto" />');
  });

  it("keeps directives and license comments ahead of imports", () => {
    const client = patchLayoutWithThemeScript(
      `// Copyright Example\n"use client";\n\nexport default function Layout() { return <html><body /></html>; }`,
    );
    const server = patchLayoutWithThemeScript(
      `/* Licensed */\nexport default function Layout() { return <html><body /></html>; }`,
    );

    expect(client).toMatch(
      /^\/\/ Copyright Example\n"use client";\n\nimport \{ ThemeScript \} from "@flowpanel\/kit\/react";/,
    );
    expect(server).toMatch(/^\/\* Licensed \*\/\nimport \{ ThemeScript \}/);
  });

  it("reuses aliased and namespaced imports", () => {
    const aliased = patchLayoutWithThemeScript(
      `import { ThemeScript as FPThemeScript } from "@flowpanel/kit/react";\n<html><body /></html>`,
    );
    const namespaced = `import * as FlowPanel from "@flowpanel/kit/react";\n<html><head><FlowPanel.ThemeScript /></head></html>`;

    expect(aliased).toContain('<FPThemeScript defaultMode="auto" />');
    expect(aliased).not.toContain("<ThemeScript");
    expect(aliased?.match(/from "@flowpanel\/kit\/react"/g)).toHaveLength(1);
    expect(patchLayoutWithThemeScript(namespaced)).toBeNull();
  });

  it("uses a conflict-free alias when the host already binds ThemeScript", () => {
    const source = `import { ThemeScript } from "./theme";\n<html><head></head><body><ThemeScript /></body></html>`;
    const result = patchLayoutWithThemeScript(source);

    expect(result).toContain(
      'import { ThemeScript as FlowPanelThemeScript } from "@flowpanel/kit/react";',
    );
    expect(result).toContain('<head>\n  <FlowPanelThemeScript defaultMode="auto" /></head>');
    expect(result?.match(/import \{ ThemeScript \}/g)).toHaveLength(1);
  });

  it("does not use a type-only ThemeScript import as a JSX value", () => {
    const source = `import type { ThemeScript } from "@flowpanel/kit/react";\n<html><head></head><body /></html>`;
    const result = patchLayoutWithThemeScript(source);

    expect(result).toContain(
      'import { ThemeScript as FlowPanelThemeScript } from "@flowpanel/kit/react";',
    );
    expect(result).toContain('<FlowPanelThemeScript defaultMode="auto" />');
  });

  it("expands a self-closing head before inserting the theme script", () => {
    const result = patchLayoutWithThemeScript(`<html>\n  <head />\n  <body />\n</html>`);

    expect(result).not.toContain("<head />");
    expect(result).toContain('<head>\n    <ThemeScript defaultMode="auto" />\n  </head>');
    expect(result?.match(/<head/g)).toHaveLength(1);
  });

  it("is idempotent and requires an html element", () => {
    const patched = `import { ThemeScript } from "@flowpanel/kit/react";\n<html><head><ThemeScript /></head></html>`;
    expect(patchLayoutWithThemeScript(patched)).toBeNull();
    expect(patchLayoutWithThemeScript("export default function Layout() {}")).toBeNull();
  });
});
