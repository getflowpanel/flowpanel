import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firstDiagnostics } from "../../doctor/probes";
import { CLI_VERSION } from "../../utils/kit";
import { type Check, runDoctorChecks } from "../doctor";

// Every case runs a full doctor pass, which shells out to `tsc --noEmit`.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-checks-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function seedPkg(deps: Record<string, string>): Promise<void> {
  await fs.writeFile(
    path.join(tmp, "package.json"),
    JSON.stringify({ dependencies: { "drizzle-orm": "^0.30.0", ...deps }, devDependencies: {} }),
  );
  await fs.writeFile(path.join(tmp, "flowpanel.config.ts"), "export default {};\n");
}

async function check(name: string): Promise<Check> {
  const { checks } = await runDoctorChecks(tmp, false);
  const found = checks.find((c) => c.name === name);
  expect(found, `no check named "${name}"`).toBeDefined();
  return found as Check;
}

describe("doctor — Next.js check", () => {
  it("says Next.js is missing rather than offering an upgrade", async () => {
    await seedPkg({});
    const nextCheck = await check("Next.js ≥ 16.3 < 17");
    expect(nextCheck.ok).toBe(false);
    expect(nextCheck.hint).toContain("not in package.json");
    expect(nextCheck.hint).not.toContain("Upgrade:");
  });

  it("offers an upgrade when a too-old Next.js is installed", async () => {
    await seedPkg({ next: "15.0.0" });
    const nextCheck = await check("Next.js ≥ 16.3 < 17");
    expect(nextCheck.ok).toBe(false);
    expect(nextCheck.hint).toContain("Upgrade:");
  });
});

describe("doctor — eject marker check", () => {
  it("is skipped on a project with no ejected admin pages", async () => {
    await seedPkg({ next: "16.3.0" });
    const { checks } = await runDoctorChecks(tmp, false);
    expect(checks.find((c) => c.name.startsWith("Ejected admin pages"))).toBeUndefined();
  });

  it("passes when every ejected page carries the marker", async () => {
    await seedPkg({ next: "16.3.0" });
    await fs.mkdir(path.join(tmp, "app/admin/users"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, "app/admin/users/page.tsx"),
      "// flowpanel: ejected @ 1.0.0 — this file is yours\nexport default () => null;\n",
    );
    expect((await check("Ejected admin pages carry the eject marker")).ok).toBe(true);
  });

  it("fails and names the file when a marker is missing", async () => {
    await seedPkg({ next: "16.3.0" });
    await fs.mkdir(path.join(tmp, "app/admin/orders"), { recursive: true });
    await fs.writeFile(path.join(tmp, "app/admin/orders/page.tsx"), "export default () => null;\n");
    const marker = await check("Ejected admin pages carry the eject marker");
    expect(marker.ok).toBe(false);
    expect(marker.hint).toContain(path.join("app", "admin", "orders", "page.tsx"));
  });

  it("ignores the catch-all route segment", async () => {
    await seedPkg({ next: "16.3.0" });
    await fs.mkdir(path.join(tmp, "app/admin/[[...slug]]"), { recursive: true });
    await fs.writeFile(path.join(tmp, "app/admin/[[...slug]]/page.tsx"), "export default 1;\n");
    const { checks } = await runDoctorChecks(tmp, false);
    expect(checks.find((c) => c.name.startsWith("Ejected admin pages"))).toBeUndefined();
  });
});

describe("doctor — kit/CLI compatibility", () => {
  async function installKit(version: string): Promise<void> {
    const kit = path.join(tmp, "node_modules/@flowpanel/kit");
    await fs.mkdir(kit, { recursive: true });
    await fs.writeFile(
      path.join(kit, "package.json"),
      JSON.stringify({ name: "@flowpanel/kit", version }),
    );
  }

  it("fails the check and refuses --fix on a minor mismatch", async () => {
    await seedPkg({ next: "16.3.0" });
    const bumped = `${Number(CLI_VERSION.split(".")[0]) + 1}.0.0`;
    await installKit(bumped);
    const { checks, plan, fixBlocked } = await runDoctorChecks(tmp, true, { quiet: true });
    const kitCheck = checks.find((c) => c.name === "@flowpanel/kit matches this CLI");
    expect(kitCheck!.ok).toBe(false);
    expect(kitCheck!.hint).toContain(bumped);
    expect(plan).toBeUndefined();
    expect(fixBlocked).toContain(bumped);
    await expect(fs.access(path.join(tmp, "app"))).rejects.toThrow();
  });

  it("passes on a matching kit", async () => {
    await seedPkg({ next: "16.3.0" });
    await installKit(CLI_VERSION);
    expect((await check("@flowpanel/kit matches this CLI")).ok).toBe(true);
  });
});

describe("firstDiagnostics", () => {
  it("surfaces the head of what tsc printed", () => {
    const out = firstDiagnostics({
      stdout: "a.ts(1,1): error TS2304: Cannot find name 'x'.\n\nb.ts(2,2): error TS2322: nope.\n",
      stderr: "",
    });
    expect(out).toContain("TS2304");
    expect(out).toContain("TS2322");
  });

  it("caps the output and says how much was cut", () => {
    const stdout = Array.from({ length: 9 }, (_, i) => `f.ts(${i},1): error TS1: e`).join("\n");
    const out = firstDiagnostics({ stdout, stderr: "" }, 3);
    expect(out?.split("\n")).toHaveLength(4);
    expect(out).toContain("… 6 more line(s)");
  });

  it("is null when the failure printed nothing", () => {
    expect(firstDiagnostics({ stdout: "", stderr: "" })).toBeNull();
    expect(firstDiagnostics(new Error("spawn failed"))).toBeNull();
  });
});
