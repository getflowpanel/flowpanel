import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runDoctorChecks } from "../doctor.js";

let tmp: string;

/** Seed a minimal package.json so detectStack doesn't blow up */
async function seedPkg(dir: string): Promise<void> {
  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({
      dependencies: {
        next: "15.0.0",
        "drizzle-orm": "^0.30.0",
      },
      devDependencies: { typescript: "^5.0.0" },
    }),
  );
}

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-fix-"));
  await seedPkg(tmp);
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("runDoctorChecks --fix", () => {
  it("writes the missing API route from template", async () => {
    const { checks } = await runDoctorChecks(tmp, true);
    const apiCheck = checks.find((c) => c.name === "API route");
    expect(apiCheck).toBeDefined();
    expect(apiCheck!.ok).toBe(true);
    const written = path.join(tmp, "app/api/flowpanel/[...route]/route.ts");
    const content = await fs.readFile(written, "utf8");
    expect(content).toContain("handlers");
  });

  it("writes the missing SSE route from template", async () => {
    const { checks } = await runDoctorChecks(tmp, true);
    const sseCheck = checks.find((c) => c.name === "SSE route");
    expect(sseCheck).toBeDefined();
    expect(sseCheck!.ok).toBe(true);
    const written = path.join(tmp, "app/api/flowpanel/stream/route.ts");
    const content = await fs.readFile(written, "utf8");
    expect(content).toContain("stream");
  });

  it("after --fix the previously-failing checks pass", async () => {
    // First run without fix — API + SSE route checks should fail
    const { checks: before } = await runDoctorChecks(tmp, false);
    const apiBefore = before.find((c) => c.name === "API route");
    const sseBefore = before.find((c) => c.name === "SSE route");
    expect(apiBefore!.ok).toBe(false);
    expect(sseBefore!.ok).toBe(false);

    // Run with fix
    const { checks: after } = await runDoctorChecks(tmp, true);
    const apiAfter = after.find((c) => c.name === "API route");
    const sseAfter = after.find((c) => c.name === "SSE route");
    expect(apiAfter!.ok).toBe(true);
    expect(sseAfter!.ok).toBe(true);
  });
});
