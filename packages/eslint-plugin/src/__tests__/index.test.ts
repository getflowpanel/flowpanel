import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import plugin, { configs, rules } from "../index.js";

const pkg = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"),
    "utf8",
  ),
) as { version: string; name: string };

describe("plugin meta", () => {
  it("reports the published version, not 0.0.0", () => {
    expect(plugin.meta.version).toBe(pkg.version);
    expect(plugin.meta.name).toBe(pkg.name);
  });
});

describe("configs.recommended", () => {
  it("registers the plugin under the `flowpanel` namespace", () => {
    expect(configs.recommended.plugins?.flowpanel).toBe(plugin);
  });

  it("enables every rule the plugin ships", () => {
    const enabled = Object.keys(configs.recommended.rules ?? {}).sort();
    expect(enabled).toEqual(
      Object.keys(rules)
        .map((name) => `flowpanel/${name}`)
        .sort(),
    );
  });

  it("severities are valid ESLint entries", () => {
    for (const entry of Object.values(configs.recommended.rules ?? {})) {
      expect(["off", "warn", "error"]).toContain(entry);
    }
  });
});
