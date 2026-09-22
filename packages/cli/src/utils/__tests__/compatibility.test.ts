import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  evaluateProjectCompatibility,
  firstCompatibilityFailure,
  inspectProjectCompatibility,
} from "../compatibility";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-compatibility-"));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: {} }));
});
afterEach(async () => fs.rm(root, { recursive: true, force: true }));

async function pkg(
  name: string,
  version: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const dir = path.join(root, "node_modules", ...name.split("/"));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ name, version, ...extra }));
}

describe("installed compatibility", () => {
  it("rejects a declared-supported Next range when the installed version is old", async () => {
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { next: "^16.3.0" } }),
    );
    await pkg("next", "16.2.9");
    const finding = (await evaluateProjectCompatibility(root)).find(
      (item) => item.name === "next",
    )!;
    expect(finding.ok).toBe(false);
    expect(finding.observed).toBe("16.2.9");
  });

  it("rejects prerelease runtimes and respects installed Next Node engines", async () => {
    await pkg("next", "16.3.0-canary.1", { engines: { node: ">=100" } });
    const findings = await evaluateProjectCompatibility(root);
    expect(findings.find((item) => item.name === "next")!.ok).toBe(false);
    expect(findings.find((item) => item.name === "Node.js")!.ok).toBe(false);
  });

  it("accepts either supported installed ORM and never makes Tailwind a prerequisite", async () => {
    await pkg("drizzle-orm", "0.45.2");
    const findings = await evaluateProjectCompatibility(root);
    expect(findings.find((item) => item.name === "drizzle-orm")!.ok).toBe(true);
    expect(findings.some((item) => item.name === "tailwindcss")).toBe(false);
  });

  it("reports missing TypeScript as an installed prerequisite", async () => {
    const error = firstCompatibilityFailure(await evaluateProjectCompatibility(root));
    expect(error).toContain("not installed");
  });

  it("rejects React and React DOM that are individually supported but differ", async () => {
    await pkg("react", "19.0.0");
    await pkg("react-dom", "19.2.7");
    const pair = (await evaluateProjectCompatibility(root)).find(
      (item) => item.name === "React and React DOM versions match",
    )!;
    expect(pair.ok).toBe(false);
    expect(pair.recovery).toContain("Align");
  });

  it("keeps a declared Prisma project on Prisma when an unrelated Drizzle is reachable", async () => {
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "@prisma/client": "^6.0.0" } }),
    );
    await pkg("@prisma/client", "6.3.0");
    await pkg("drizzle-orm", "0.30.0");
    const report = await inspectProjectCompatibility(root);
    expect(report.orm).toBe("prisma");
    expect(report.ormFinding!.ok).toBe(true);
  });

  it("does not ignore an unsupported declared Drizzle because Prisma is installed", async () => {
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "drizzle-orm": "^0.45.2" } }),
    );
    await pkg("drizzle-orm", "0.30.0");
    await pkg("@prisma/client", "6.3.0");
    const report = await inspectProjectCompatibility(root);
    expect(report.orm).toBe("drizzle");
    expect(report.ormFinding!.ok).toBe(false);
  });

  it("keeps the established Drizzle precedence when both adapters are declared", async () => {
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "drizzle-orm": "^0.45.2", "@prisma/client": "^6" } }),
    );
    await pkg("drizzle-orm", "0.45.2");
    await pkg("@prisma/client", "6.3.0");
    expect((await inspectProjectCompatibility(root)).orm).toBe("drizzle");
  });
});

describe("PnP-only layouts", () => {
  it("says what is actually wrong instead of blaming a version", async () => {
    await fs.writeFile(path.join(root, ".pnp.cjs"), "// pnp\n");
    const failure = firstCompatibilityFailure(await evaluateProjectCompatibility(root));
    expect(failure).toContain("PnP-only layout");
    expect(failure).toContain("nodeLinker node-modules");
    expect(failure).not.toContain("Required >=16.3.0");
  });
});

describe("PnP detection boundaries", () => {
  it("ignores a .pnp.cjs that belongs to a different install root", async () => {
    const app = path.join(root, "apps", "web");
    await fs.mkdir(path.join(app, "node_modules"), { recursive: true });
    await fs.writeFile(path.join(app, "package.json"), JSON.stringify({ dependencies: {} }));
    await fs.writeFile(path.join(app, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await fs.writeFile(path.join(root, ".pnp.cjs"), "// pnp\n");
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "outer" }));
    const failure = firstCompatibilityFailure(await evaluateProjectCompatibility(app));
    expect(failure).not.toContain("PnP-only layout");
    expect(failure).toContain("Required >=16.3.0");
  });

  it("needs a manifest beside .pnp.cjs before calling a layout PnP", async () => {
    await fs.writeFile(path.join(root, ".pnp.cjs"), "// pnp\n");
    await fs.rm(path.join(root, "package.json"));
    const failure = firstCompatibilityFailure(await evaluateProjectCompatibility(root));
    expect(failure).not.toContain("PnP-only layout");
  });
});
