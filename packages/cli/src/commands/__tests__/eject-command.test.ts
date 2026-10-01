import { describe, expect, it } from "vitest";
import { ejectCommand } from "../eject";
import { runCommand } from "./command-harness";

const NEXT = JSON.stringify({ dependencies: { next: "16.3.4" } });
const CONFIG = "import { defineAdmin } from '@flowpanel/kit';\nexport default defineAdmin({});\n";
const EXISTING = {
  "package.json": NEXT,
  "flowpanel.config.ts": CONFIG,
  "app/admin/layout.tsx": "export default function Layout() { return null; }\n",
};

describe("eject command", () => {
  it("prints the plan and how to overwrite when the target exists, and exits 1", async () => {
    const result = await runCommand(ejectCommand, ["eject", "layout"], EXISTING);
    expect(result.exit).toBe(1);
    expect(result.stdout).toContain("conflict app/admin/layout.tsx");
    expect(result.stdout).toContain("Use --force to overwrite.");
    expect(result.stdout.indexOf("conflict app/admin/layout.tsx")).toBeLessThan(
      result.stdout.indexOf("Use --force to overwrite."),
    );
  });

  it("prints the same hint on a dry run and keeps exit 0", async () => {
    const result = await runCommand(ejectCommand, ["eject", "layout", "--dry-run"], EXISTING);
    expect(result.exit).toBeNull();
    expect(result.stdout).toContain("conflict app/admin/layout.tsx");
    expect(result.stdout).toContain("Use --force to overwrite.");
    expect(result.stdout).toContain("Dry run complete.");
  });

  it("leaves the not-found page init wrote out of an ejected resource's plan", async () => {
    const result = await runCommand(ejectCommand, ["eject", "resource", "users", "--dry-run"], {
      "package.json": NEXT,
      "flowpanel.config.ts":
        "import { defineAdmin, resource } from '@flowpanel/kit';\nimport * as schema from './db/schema';\nexport default defineAdmin({ resources: [resource(schema.users, {})] });\n",
      "app/admin/not-found.tsx": "export default function NotFound() { return null; }\n",
    });
    expect(result.exit).toBeNull();
    expect(result.stdout).toContain("create app/admin/users/page.tsx");
    expect(result.stdout).not.toContain("not-found");
    expect(result.stdout).not.toContain("--force");
  });

  it("does not mention --force when nothing conflicts", async () => {
    const result = await runCommand(ejectCommand, ["eject", "layout", "--dry-run"], {
      "package.json": NEXT,
      "flowpanel.config.ts": CONFIG,
    });
    expect(result.stdout).toContain("create app/admin/layout.tsx");
    expect(result.stdout).not.toContain("--force");
  });

  it("overwrites with --force", async () => {
    const result = await runCommand(ejectCommand, ["eject", "layout", "--force"], EXISTING);
    expect(result.exit).toBeNull();
    expect(result.stdout).toContain("Ejected layout");
  });

  it("names the directory when it is not a Next.js project", async () => {
    const result = await runCommand(ejectCommand, ["eject", "layout"], {});
    expect(result.exit).toBe(1);
    expect(result.stdout).toContain(`No Next.js project found in ${result.dir}.`);
    expect(result.stdout).toContain("Run this from your project root.");
  });

  it("keeps the JSON error for a conflict", async () => {
    const result = await runCommand(ejectCommand, ["eject", "layout", "--json"], EXISTING);
    expect(result.exit).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ command: "eject", applied: false });
  });
});
