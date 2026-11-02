import { globSync, readFileSync } from "node:fs";

const violations: string[] = [];

// Rule 1: core must never execute React or Next.js at runtime; type-only imports are fine.
for (const file of globSync("packages/core/src/**/*.ts", {
  exclude: ["**/__tests__/**", "**/*.test.ts", "**/*.test-d.ts"],
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
  exclude: ["**/__tests__/**", "**/*.test.ts", "**/*.test-d.ts"],
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
    exclude: ["**/__tests__/**", "**/*.test.ts"],
    cwd: process.cwd(),
  })) {
    const src = readFileSync(file, "utf-8");
    if (/from\s+["']@flowpanel\/react/.test(src)) {
      violations.push(`${file}: imports from @flowpanel/react`);
    }
  }
}

// Rule 3: adapters reach @flowpanel/core through its public index. The
// exceptions are `internal/migration-sql`, the SQL lexer, and `internal`, which
// carries the filter walk: the two adapters share them instead of forking them,
// and the `internal` prefix keeps them out of the user-facing API.
const SHARED_CORE_INTERNALS = new Set(["internal", "internal/migration-sql"]);
for (const pkg of ["adapter-prisma", "adapter-drizzle", "adapter-bullmq"]) {
  for (const file of globSync(`packages/${pkg}/src/**/*.ts`, {
    exclude: ["**/__tests__/**", "**/*.test.ts"],
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
  exclude: ["**/__tests__/**", "**/*.test.*"],
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
  ["packages/flowpanel/src/next.ts", /from\s+["']@flowpanel\/(?!next["'])/],
  ["packages/flowpanel/src/charts.ts", /from\s+["']@flowpanel\/(?!charts["'])/],
];
for (const [file, forbidden] of facadeRules) {
  const src = readFileSync(file, "utf-8");
  if (forbidden.test(src)) violations.push(`${file}: crosses its public package boundary`);
}

// React code ships to browsers. Runtime helpers must use a pure core subpath:
// the root barrel also exports Node request-context code (async_hooks).
for (const file of globSync("packages/react/src/**/*.{ts,tsx}", {
  exclude: ["**/__tests__/**", "**/*.test.*"],
  cwd: process.cwd(),
})) {
  const src = readFileSync(file, "utf-8");
  if (/^(?:import|export)(?!\s+type\b)[^;]*from\s+["']@flowpanel\/core["']/m.test(src)) {
    violations.push(`${file}: runtime core root import in browser code (use a pure subpath)`);
  }
}

// React source layout: folders carry no underscore, and a file is a PascalCase component, a
// `useX` hook or kebab-case, so a name says what the file holds.
const REACT_SRC = "packages/react/src/";
const FILE_NAME = /^(?:[A-Z][A-Za-z0-9]*|use[A-Z][A-Za-z0-9]*|[a-z0-9]+(?:-[a-z0-9]+)*)$/;
for (const file of globSync(`${REACT_SRC}**/*.{ts,tsx,css}`, { cwd: process.cwd() })) {
  const parts = file.slice(REACT_SRC.length).split("/");
  const name = parts.pop() ?? "";
  if (parts.some((dir) => dir.startsWith("_") && dir !== "__tests__")) {
    violations.push(`${file}: folders under react/src take no leading underscore`);
  }
  if (parts.includes("__tests__")) continue;
  if (!FILE_NAME.test(name.replace(/\.(?:tsx?|css)$/, ""))) {
    violations.push(`${file}: name it PascalCase (component), useX (hook) or kebab-case`);
  }
}

if (violations.length > 0) {
  console.error("Import boundary violations:");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("✔ Import boundaries clean.");
