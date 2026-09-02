import { readFileSync } from "node:fs";
import { join } from "node:path";

interface PackageMetadata {
  engines?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface CompatibilityItem {
  id: "node" | "next" | "react" | "tailwind" | "drizzle" | "prisma";
  requirement: string;
  range: string;
  note: string;
  source: string;
}

export const COMPATIBILITY_OVERRIDES = [
  {
    id: "next",
    range: "^16.3.0",
    reason:
      "The CLI init and doctor commands enforce Next.js 16.3 or newer because the generated App Router wiring depends on that baseline.",
  },
] as const;

function readPackage(root: string, path: string): PackageMetadata {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as PackageMetadata;
}

function requireValue(value: string | undefined, source: string): string {
  if (value === undefined) throw new Error(`Compatibility source is missing: ${source}`);
  return value;
}

export function readCompatibility(root: string): CompatibilityItem[] {
  const cli = readPackage(root, "packages/cli/package.json");
  const next = readPackage(root, "packages/next/package.json");
  const react = readPackage(root, "packages/react/package.json");
  const drizzle = readPackage(root, "packages/adapter-drizzle/package.json");
  const prisma = readPackage(root, "packages/adapter-prisma/package.json");
  const nextOverride = COMPATIBILITY_OVERRIDES.find((item) => item.id === "next");

  return [
    {
      id: "node",
      requirement: "Node.js",
      range: requireValue(cli.engines?.node, "packages/cli/package.json#engines.node"),
      note: "Required by the CLI and runtime packages.",
      source: "packages/cli/package.json#engines.node",
    },
    {
      id: "next",
      requirement: "Next.js",
      range:
        nextOverride?.range ??
        requireValue(
          next.peerDependencies?.next,
          "packages/next/package.json#peerDependencies.next",
        ),
      note: nextOverride?.reason ?? "App Router only.",
      source: "packages/next/package.json#peerDependencies.next",
    },
    {
      id: "react",
      requirement: "React",
      range: requireValue(
        react.peerDependencies?.react,
        "packages/react/package.json#peerDependencies.react",
      ),
      note: "React DOM uses the same major version.",
      source: "packages/react/package.json#peerDependencies.react",
    },
    {
      id: "tailwind",
      requirement: "Tailwind CSS",
      range: requireValue(
        react.peerDependencies?.tailwindcss,
        "packages/react/package.json#peerDependencies.tailwindcss",
      ),
      note: "The CLI generates the matching v3 or v4 stylesheet.",
      source: "packages/react/package.json#peerDependencies.tailwindcss",
    },
    {
      id: "drizzle",
      requirement: "Drizzle ORM",
      range: requireValue(
        drizzle.peerDependencies?.["drizzle-orm"],
        "packages/adapter-drizzle/package.json#peerDependencies.drizzle-orm",
      ),
      note: "Required only when using the Drizzle adapter.",
      source: "packages/adapter-drizzle/package.json#peerDependencies.drizzle-orm",
    },
    {
      id: "prisma",
      requirement: "Prisma Client",
      range: requireValue(
        prisma.peerDependencies?.["@prisma/client"],
        "packages/adapter-prisma/package.json#peerDependencies.@prisma/client",
      ),
      note: "Required only when using the Prisma adapter.",
      source: "packages/adapter-prisma/package.json#peerDependencies.@prisma/client",
    },
  ];
}
