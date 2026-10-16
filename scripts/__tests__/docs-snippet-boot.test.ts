import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bootTutorial, tutorialSteps } from "../docs/check-snippet-boot";

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const fence = "```";

function page(...sections: string[]): string {
  return ["---", "title: Tutorial", "---", "", ...sections].join("\n");
}

const before = [
  "## Before you start",
  `${fence}ts`,
  "// src/db/schema.ts",
  'import { pgTable, serial } from "drizzle-orm/pg-core";',
  "",
  'export const things = pgTable("things", { id: serial("id").primaryKey() });',
  fence,
  `${fence}ts`,
  "// src/db/index.ts",
  "export const db = {};",
  fence,
  "",
  "## 1. Install",
  `${fence}bash`,
  "pnpm dlx @flowpanel/cli init --dev-auth",
  fence,
  "You should see an empty admin.",
  "",
].join("\n");

/** Under the site, so the project resolves the site's packages as a reader's app would. */
function bootRoot(): string {
  const parent = resolve(import.meta.dirname, "../../apps/site/content/snippets/.boot-test");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "run-"));
  roots.push(root);
  return root;
}

describe("tutorial steps", () => {
  it("replays init, moves and file listings, and keeps the project of each step that claims a result", () => {
    const steps = tutorialSteps(
      page(
        before,
        "## 2. Move",
        `${fence}bash`,
        "mv flowpanel.config.ts src/admin/config/index.ts",
        "echo 'export { default } from \"./src/admin/config\";' > flowpanel.config.ts",
        fence,
        "Nothing to see yet.",
        "",
        "## 3. Check",
        "You should see the same admin.",
      ),
    );
    expect(steps.map((step) => step.heading)).toEqual(["1. Install", "3. Check"]);
    expect(steps[0]?.files.get("flowpanel.config.ts")).toContain("defineAdmin(");
    expect(steps[0]?.files.has("src/server/lib/auth.ts")).toBe(true);
    expect(steps[1]?.files.get("flowpanel.config.ts")).toBe(
      'export { default } from "./src/admin/config";\n',
    );
    expect(steps[1]?.files.get("src/admin/config/index.ts")).toContain("defineAdmin(");
  });

  it("boots a step that works and names the step whose files import each other", () => {
    const problems = bootTutorial(
      "intro/tutorial.mdx",
      page(
        before,
        "## 2. A cycle",
        `${fence}ts`,
        "// src/db/schema.ts",
        'import { pgTable, serial } from "drizzle-orm/pg-core";',
        'import { db } from "./index";',
        "",
        "export const both = db;",
        'export const things = pgTable("things", { id: serial("id").primaryKey() });',
        fence,
        `${fence}ts`,
        "// src/db/index.ts",
        'import { things } from "./schema";',
        "",
        "export const db = { things };",
        fence,
        "You should see the same admin.",
      ),
      bootRoot(),
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(
      /tutorial\.mdx:\d+ \(2\. A cycle\) import cycle: src\/db\/index\.ts → src\/db\/schema\.ts → src\/db\/index\.ts/,
    );
    expect(problems[1]).toMatch(/\(2\. A cycle\) fails at startup: .*before initialization/);
  }, 120_000);

  it("ignores a back-import of types only, which cannot cycle at runtime", () => {
    const problems = bootTutorial(
      "intro/tutorial.mdx",
      page(
        before,
        "## 2. Types",
        `${fence}ts`,
        "// src/db/schema.ts",
        'import { pgTable, serial } from "drizzle-orm/pg-core";',
        'import type { Db } from "./index";',
        "",
        "export type Handle = Db;",
        'export const things = pgTable("things", { id: serial("id").primaryKey() });',
        fence,
        `${fence}ts`,
        "// src/db/index.ts",
        'import { fileURLToPath } from "node:url";',
        'import { things } from "./schema";',
        "",
        "export type Db = { things: typeof things };",
        'export const db = { things, here: fileURLToPath("file:///tmp/x") };',
        fence,
        "You should see the same admin.",
      ),
      bootRoot(),
    );
    expect(problems).toEqual([]);
  }, 120_000);

  it("runs a worker script as CommonJS and names a prefix built from an unset variable", () => {
    const problems = bootTutorial(
      "intro/tutorial.mdx",
      page(
        before,
        "## 2. Worker",
        `${fence}ts`,
        "// scripts/publish.ts",
        'import { createPublisher } from "@flowpanel/kit/publish";',
        "",
        "const events = createPublisher({",
        '  driver: "redis",',
        "  url: process.env.REDIS_URL!,",
        '  keyPrefix: "app-" + process.env.NODE_ENV,',
        "});",
        "",
        "async function run(): Promise<void> {",
        '  await events.publish("pipeline");',
        "  await events.close();",
        "}",
        "",
        "void run();",
        fence,
        `${fence}bash`,
        "pnpm tsx --env-file=.env scripts/publish.ts",
        fence,
        "You should see the card refresh.",
      ),
      bootRoot(),
    );
    expect(problems).toEqual([
      expect.stringMatching(
        /\(2\. Worker\) scripts\/publish\.ts publishes to app-undefined:pipeline$/,
      ),
    ]);
  }, 120_000);

  it("fails the step whose config subscribes to a channel it does not declare", () => {
    const problems = bootTutorial(
      "intro/tutorial.mdx",
      page(
        before,
        "## 2. Live",
        `${fence}ts`,
        "// flowpanel.config.ts",
        'import { custom, dashboard, defineAdmin } from "@flowpanel/kit";',
        'import { drizzleAdapter } from "@flowpanel/kit/drizzle";',
        'import { db } from "@/db";',
        'import * as schema from "@/db/schema";',
        'import { getSession } from "@/server/lib/auth";',
        "",
        "const Card = () => null;",
        "",
        "export default defineAdmin({",
        "  adapter: drizzleAdapter({ db, schema }),",
        '  auth: { session: getSession, access: "admin" },',
        "  dashboards: [",
        "    dashboard({",
        '      path: "/",',
        '      label: "Overview",',
        '      sections: [{ widgets: [custom(Card, async () => ({}), { label: "Queue", realtime: "pipeline" })] }],',
        "    }),",
        "  ],",
        "});",
        fence,
        "You should see a live card.",
      ),
      bootRoot(),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/\(2\. Live\) fails at startup: .*"pipeline".*realtime\.channels/);
  }, 120_000);
});
