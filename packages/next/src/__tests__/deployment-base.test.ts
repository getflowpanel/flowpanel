import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { withDeploymentBasePath } from "@flowpanel/core/paths";
import { afterEach, describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const nextRoot = path.dirname(require_.resolve("next/package.json"));
const nextVersion = (
  JSON.parse(readFileSync(path.join(nextRoot, "package.json"), "utf8")) as { version: string }
).version;

/**
 * `__NEXT_ROUTER_BASEPATH` is Next's own compile-time constant, not public API.
 * These two checks are the coupling: the installed release must be one FlowPanel
 * supports, and it must still substitute that name.
 */
describe("the Next constant a deployment basePath is read from", () => {
  it("runs against a Next release FlowPanel supports", () => {
    const [major, minor] = nextVersion.split(".").map(Number) as [number, number];
    expect(major).toBe(16);
    expect(minor).toBeGreaterThanOrEqual(3);
  });

  it("is still the name Next itself replaces", () => {
    const hits = execFileSync(
      "grep",
      ["-rl", "--include=*.js", "__NEXT_ROUTER_BASEPATH", nextRoot],
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("withDeploymentBasePath", () => {
  afterEach(() => {
    delete process.env.__NEXT_ROUTER_BASEPATH;
  });

  it("returns an app-relative path unchanged when no basePath is deployed", () => {
    expect(withDeploymentBasePath("/api/flowpanel")).toBe("/api/flowpanel");
  });

  it("prefixes exactly once", () => {
    process.env.__NEXT_ROUTER_BASEPATH = "/host";
    expect(withDeploymentBasePath("/api/flowpanel")).toBe("/host/api/flowpanel");
  });

  it("leaves an absolute URL and a relative specifier alone", () => {
    process.env.__NEXT_ROUTER_BASEPATH = "/host";
    expect(withDeploymentBasePath("https://api.example.com/x")).toBe("https://api.example.com/x");
    expect(withDeploymentBasePath("api/flowpanel")).toBe("api/flowpanel");
  });

  it("ignores a value that is not a rooted path", () => {
    for (const value of ["", "/", "undefined", "host"]) {
      process.env.__NEXT_ROUTER_BASEPATH = value;
      expect(withDeploymentBasePath("/api/flowpanel")).toBe("/api/flowpanel");
    }
  });
});
