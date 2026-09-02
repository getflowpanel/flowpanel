import { globSync, readFileSync } from "node:fs";

const violations: string[] = [];

// Rule 1: core must never execute React or Next.js at runtime. Type-only
// render extension contracts remain a 0.2 compatibility bridge.
for (const file of globSync("packages/core/src/**/*.ts", {
  ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test-d.ts"],
  cwd: process.cwd(),
})) {
  const src = readFileSync(file, "utf-8");
  if (/^import(?!\s+type\b)[^;]*from\s+["'](?:react|next(?:\/[^"']*)?)["']/m.test(src)) {
    violations.push(`${file}: runtime import from React or Next.js`);
  }
}

// Rule 1b: core is the framework-agnostic base and must never depend on the UI
// package. madge --circular cannot see this: it does not resolve workspace specifiers.
for (const file of globSync("packages/core/src/**/*.ts", {
  ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.test-d.ts"],
  cwd: process.cwd(),
})) {
  const src = readFileSync(file, "utf-8");
  if (/from\s+["']@flowpanel\/react/.test(src)) {
    violations.push(`${file}: imports from @flowpanel/react`);
  }
}

// Rule 2: adapter-* and queue-* must not import from @flowpanel/react
for (const pkg of ["adapter-prisma", "adapter-drizzle", "adapter-bullmq"]) {
  for (const file of globSync(`packages/${pkg}/src/**/*.ts`, {
    ignore: ["**/__tests__/**", "**/*.test.ts"],
    cwd: process.cwd(),
  })) {
    const src = readFileSync(file, "utf-8");
    if (/from\s+["']@flowpanel\/react/.test(src)) {
      violations.push(`${file}: imports from @flowpanel/react`);
    }
  }
}

// Rule 3: adapters reach @flowpanel/core through its public index. The one
// exception is `internal/migration-sql`: core exports the SQL lexer on that
// subpath so the two adapters share one tokenizer instead of forking it, and
// the `internal/` prefix keeps it out of the user-facing API.
const SHARED_CORE_INTERNALS = new Set(["internal/migration-sql"]);
for (const pkg of ["adapter-prisma", "adapter-drizzle", "adapter-bullmq"]) {
  for (const file of globSync(`packages/${pkg}/src/**/*.ts`, {
    ignore: ["**/__tests__/**", "**/*.test.ts"],
    cwd: process.cwd(),
  })) {
    const src = readFileSync(file, "utf-8");
    for (const [, subpath] of src.matchAll(/from\s+["']@flowpanel\/core\/([^"']+)["']/g)) {
      if (!SHARED_CORE_INTERNALS.has(subpath)) {
        violations.push(`${file}: deep import from @flowpanel/core (use public index)`);
      }
    }
  }
}

// Rule 4: the framework-neutral transport must not import Next.js.
for (const file of globSync("packages/client/src/**/*.{ts,tsx}", {
  ignore: ["**/__tests__/**", "**/*.test.*"],
  cwd: process.cwd(),
})) {
  const src = readFileSync(file, "utf-8");
  if (/from\s+["']next(?:\/[^"']*)?["']/.test(src)) {
    violations.push(`${file}: imports Next.js from the framework-neutral client package`);
  }
}

// Rule 5: public façade entrypoints are explicit package boundaries. The root
// must not make bundlers traverse framework, UI or ORM packages.
const facadeRules: Array<[string, RegExp]> = [
  ["packages/flowpanel/src/index.ts", /from\s+["']@flowpanel\/(?!core["'])/],
  ["packages/flowpanel/src/client.ts", /from\s+["']@flowpanel\/(?!client["'])/],
  ["packages/flowpanel/src/react.ts", /from\s+["']@flowpanel\/(?!react["'])/],
  ["packages/flowpanel/src/next-client.ts", /from\s+["']@flowpanel\/(?!next\/client["'])/],
];
for (const [file, forbidden] of facadeRules) {
  const src = readFileSync(file, "utf-8");
  if (forbidden.test(src)) violations.push(`${file}: crosses its public package boundary`);
}

if (violations.length > 0) {
  console.error("Import boundary violations:");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("✔ Import boundaries clean.");
