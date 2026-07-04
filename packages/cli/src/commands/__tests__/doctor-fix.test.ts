import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDoctorChecks } from "../doctor.js";

// Each check writes template files and runs the full doctor pass (the last
// test runs it twice); 5s is tight on slow CI runners.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

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

  it("writes a resolvable config import (no bare @/flowpanel.config with no alias)", async () => {
    // No tsconfig.json in this fixture → aliasMode "none" → `@/flowpanel.config`
    // would not resolve. The fix must emit a relative path instead.
    await runDoctorChecks(tmp, true);
    const apiContent = await fs.readFile(
      path.join(tmp, "app/api/flowpanel/[...route]/route.ts"),
      "utf8",
    );
    expect(apiContent).toContain('import config from "../../../../flowpanel.config";');
    const adminContent = await fs.readFile(
      path.join(tmp, "app/admin/[[...slug]]/page.tsx"),
      "utf8",
    );
    expect(adminContent).toContain('import config from "../../../flowpanel.config";');
  });

  it("on a src/app project, fixes land under src/app/ (not a shadowing root app/)", async () => {
    const srcTmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-fix-srcapp-"));
    try {
      await seedPkg(srcTmp);
      await fs.mkdir(path.join(srcTmp, "src/app"), { recursive: true });
      await fs.writeFile(
        path.join(srcTmp, "src/app/layout.tsx"),
        "export default function Layout() { return null; }\n",
      );

      const { checks } = await runDoctorChecks(srcTmp, true);
      const apiCheck = checks.find((c) => c.name === "API route");
      const adminCheck = checks.find((c) => c.name === "Catch-all admin page");
      expect(apiCheck!.ok).toBe(true);
      expect(adminCheck!.ok).toBe(true);

      expect(
        await fs.access(path.join(srcTmp, "src/app/api/flowpanel/[...route]/route.ts")).then(
          () => true,
          () => false,
        ),
      ).toBe(true);
      expect(
        await fs.access(path.join(srcTmp, "src/app/admin/[[...slug]]/page.tsx")).then(
          () => true,
          () => false,
        ),
      ).toBe(true);

      // Must not create a shadowing root-level app/ directory.
      expect(
        await fs.access(path.join(srcTmp, "app")).then(
          () => true,
          () => false,
        ),
      ).toBe(false);

      const apiContent = await fs.readFile(
        path.join(srcTmp, "src/app/api/flowpanel/[...route]/route.ts"),
        "utf8",
      );
      expect(apiContent).toContain('import config from "../../../../../flowpanel.config";');
    } finally {
      await fs.rm(srcTmp, { recursive: true, force: true });
    }
  });
});
