import { readFileSync } from "node:fs";
import { join } from "node:path";

interface PackageMetadata {
  engines?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface CompatibilityItem {
  id: "node" | "next" | "react" | "drizzle" | "prisma";
  requirement: string;
  range: string;
  note: string;
  source: string;
}

function readPackage(root: string, path: string): PackageMetadata {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as PackageMetadata;
}

function requireValue(value: string | undefined, source: string): string {
  if (value === undefined) throw new Error(`Compatibility source is missing: ${source}`);
  return value;
}

export function readCompatibility(root: string): CompatibilityItem[] {
  const cli = readPackage(root, "packages/cli/package.json");
  const kit = readPackage(root, "packages/flowpanel/package.json");

  return [
    {
      id: "node",
      requirement: "Node.js",
      range: requireValue(cli.engines?.node, "packages/cli/package.json#engines.node"),
      note: "Required by the CLI and the kit.",
      source: "packages/cli/package.json#engines.node",
    },
    {
      id: "next",
      requirement: "Next.js",
      range: requireValue(
        kit.peerDependencies?.next,
        "packages/flowpanel/package.json#peerDependencies.next",
      ),
      note: "App Router only. Use 15.5.28+ or 16.4.1+, which fix critical security advisories. With `cacheComponents` on, 16.3 or newer.",
      source: "packages/flowpanel/package.json#peerDependencies.next",
    },
    {
      id: "react",
      requirement: "React",
      range: requireValue(
        kit.peerDependencies?.react,
        "packages/flowpanel/package.json#peerDependencies.react",
      ),
      note: "React DOM uses the same major version.",
      source: "packages/flowpanel/package.json#peerDependencies.react",
    },
    {
      id: "drizzle",
      requirement: "Drizzle ORM",
      range: requireValue(
        kit.peerDependencies?.["drizzle-orm"],
        "packages/flowpanel/package.json#peerDependencies.drizzle-orm",
      ),
      note: "Required only when using the Drizzle adapter.",
      source: "packages/flowpanel/package.json#peerDependencies.drizzle-orm",
    },
    {
      id: "prisma",
      requirement: "Prisma Client",
      range: requireValue(
        kit.peerDependencies?.["@prisma/client"],
        "packages/flowpanel/package.json#peerDependencies.@prisma/client",
      ),
      note: "Prisma 5 and 6, only when using the Prisma adapter. Prisma 7 is not supported yet.",
      source: "packages/flowpanel/package.json#peerDependencies.@prisma/client",
    },
  ];
}
