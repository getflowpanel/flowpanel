import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");
const REACT_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"@flowpanel\/react"/gs;

/**
 * Under RSC every export of a `"use client"` module is a client reference, so a
 * server module may render its components but must never call one of its
 * functions. Helpers belong in @flowpanel/core, which both sides can call.
 */
function helperImports(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(REACT_IMPORT)) {
    if (match[1]) continue;
    for (const entry of (match[2] ?? "").split(",")) {
      const name = entry.trim();
      if (name === "" || name.startsWith("type ")) continue;
      const local = name.split(/\s+as\s+/)[0]?.trim() ?? "";
      if (local !== "" && local[0] === local[0]?.toLowerCase()) found.push(local);
    }
  }
  return found;
}

function serverModules(): string[] {
  return globSync("**/*.{ts,tsx}", { cwd: SRC })
    .filter((file) => !file.includes("__tests__"))
    .filter(
      (file) => !readFileSync(join(SRC, file), "utf8").trimStart().startsWith('"use client"'),
    );
}

describe("server modules import no runtime helper from @flowpanel/react", () => {
  it("covers the widget render path", () => {
    const covered = serverModules();
    expect(covered).toContain("runtime/render-widget.tsx");
    expect(covered).toContain("runtime/render-table-widget.tsx");
    expect(covered).toContain("runtime/widget-context.ts");
  });

  it("finds no lowercase value import in any server module", () => {
    const offenders = serverModules()
      .map((file) => [file, helperImports(readFileSync(join(SRC, file), "utf8"))] as const)
      .filter(([, names]) => names.length > 0);
    expect(offenders).toEqual([]);
  });

  it("recognises a helper import as an offender", () => {
    expect(helperImports('import { MetricCard, formatNumber } from "@flowpanel/react";')).toEqual([
      "formatNumber",
    ]);
    expect(helperImports('import { MetricCard } from "@flowpanel/react";')).toEqual([]);
    expect(helperImports('import type { MetricCardProps } from "@flowpanel/react";')).toEqual([]);
  });
});
