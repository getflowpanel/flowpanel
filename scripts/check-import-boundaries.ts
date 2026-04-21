import { readFileSync, globSync } from "node:fs";

const violations: string[] = [];

// Rule 1: core must not import from @flowpanel/react
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
for (const pkg of ["adapter-prisma", "adapter-drizzle", "queue-bullmq"]) {
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

// Rule 3: packages must import from @flowpanel/core only via public index (not deep imports)
for (const pkg of ["adapter-prisma", "adapter-drizzle", "queue-bullmq"]) {
  for (const file of globSync(`packages/${pkg}/src/**/*.ts`, {
    ignore: ["**/__tests__/**", "**/*.test.ts"],
    cwd: process.cwd(),
  })) {
    const src = readFileSync(file, "utf-8");
    if (/from\s+["']@flowpanel\/core\/[^"']+/.test(src)) {
      violations.push(`${file}: deep import from @flowpanel/core (use public index)`);
    }
  }
}

if (violations.length > 0) {
  console.error("Import boundary violations:");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("✔ Import boundaries clean.");
