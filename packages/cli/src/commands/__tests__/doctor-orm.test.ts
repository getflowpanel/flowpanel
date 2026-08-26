import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Check, runDoctorChecks } from "../doctor";

// Every case runs a full doctor pass, which shells out to `tsc --noEmit`.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fp-doctor-orm-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function seedPkg(deps: Record<string, string>): Promise<Check> {
  await fs.writeFile(
    path.join(tmp, "package.json"),
    JSON.stringify({ dependencies: { next: "15.0.0", ...deps }, devDependencies: {} }),
  );
  const { checks } = await runDoctorChecks(tmp, false);
  const ormCheck = checks.find((c) => c.name.startsWith("ORM adapter"));
  expect(ormCheck).toBeDefined();
  return ormCheck as Check;
}

describe("doctor — ORM adapter check", () => {
  it("passes on a Drizzle project", async () => {
    const check = await seedPkg({ "drizzle-orm": "^0.30.0" });
    expect(check.ok).toBe(true);
    expect(check.name).toBe("ORM adapter (Drizzle)");
  });

  it("passes on a Prisma project — `init` supports it, so doctor must not fail it", async () => {
    const check = await seedPkg({ "@prisma/client": "^6.0.0" });
    expect(check.ok).toBe(true);
    expect(check.name).toBe("ORM adapter (Prisma)");
  });

  it("fails with a hint naming both ORMs when neither is installed", async () => {
    const check = await seedPkg({});
    expect(check.ok).toBe(false);
    expect(check.name).toBe("ORM adapter (Drizzle or Prisma)");
    expect(check.hint).toContain("drizzle-orm");
    expect(check.hint).toContain("@prisma/client");
  });
});
